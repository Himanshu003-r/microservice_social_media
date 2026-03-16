import amqp from "amqplib"
import logger from "./logger.js"

let connection = null;
let channel = null;

const EXCHANGE_NAME = 'social_media_events'

export async function connectRabbitMQ(retries = 10, delay = 5000) {
    for (let i = 0; i < retries; i++) {
        try {
            connection = await amqp.connect(process.env.RABBITMQ_URL)
            channel = await connection.createChannel()

            await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: false })
            logger.info('Connected to RabbitMQ')

            // Auto-reconnect if connection drops
            connection.on('close', async () => {
                logger.warn('RabbitMQ connection closed, reconnecting...')
                setTimeout(() => connectRabbitMQ(), delay)
            })

            connection.on('error', (err) => {
                logger.error('RabbitMQ connection error', err)
            })

            return channel
        } catch (error) {
            logger.error(`RabbitMQ connection attempt ${i + 1}/${retries} failed`, error)
            if (i < retries - 1) {
                logger.info(`Retrying in ${delay / 1000}s...`)
                await new Promise(res => setTimeout(res, delay))
            }
        }
    }
    throw new Error('Could not connect to RabbitMQ after all retries')
}


export async function publishEvent(routingKey, message){
    if(!channel){
        await connectRabbitMQ()
    }

    channel.publish(EXCHANGE_NAME,routingKey, Buffer.from(JSON.stringify(message)))
    logger.info(`Event published: ${routingKey}`)
}

export async function consumeEvent(routingKey,callback){
    if(!channel){
        await connectRabbitMQ()
    }

    const queue = await channel.assertQueue('',{exclusive: true})
    await channel.bindQueue(queue.queue, EXCHANGE_NAME,routingKey)
    channel.consume(queue.queue,(msg)=> {
        if(msg!==null){
            const content = JSON.parse(msg.content.toString())
            callback(content)
            channel.ack(msg)
        }
    })
    logger.info(`Subscribed to event: ${routingKey}`)
}

