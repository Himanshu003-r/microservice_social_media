import amqp from "amqplib"
import logger from "./logger.js"

let connection = null;
let channel = null;

const EXCHANGE_NAME = 'social_media_events'

export async function connectRabbitMQ(){
    try {
        connection = await amqp.connect(process.env.RABBITMQ_URL)
        channel = await connection.createChannel()

        await channel.assertExchange(EXCHANGE_NAME,'topic',{durable: false})
        logger.info('Connected to rabbit mq')
        return channel
    } catch (error) {
        logger.error('Error connecting to rabbit mq',error)
    }
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

