### Microservice architecture of social media platform
ARCHITECTUTE 
   
   Api gateway
   
   Identity service
   
   Post service
   
   Search service

   Media service

The server uses caching for fast query searches and reduces latency by manifolds
The messaging broker Rabbitmq is used for loose coupling and independency from different services

The application have rate limiting feature which tracks the request hit per IP address and prvent DDOS and CSRF attacks

With use of Redis the heavily requested data is stored in cache which enables fast retrival and querying thus reducing the data fetching time

With the authentication being done at Api gateway the need to do authentication is not needed which reduces the load on server

