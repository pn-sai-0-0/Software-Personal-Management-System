Check whether the port is free and the database connectivity have right database and credentials.
In your VS install:
 - Extention Pack for Java(by Microsoft)
 - Live Server
 - Spring boot extention pack(by VMware)
 - Git Extention pack

 -- Changes can be done on:
   >Port, Database, Username(for MYSQL), Passoword(for MYSQL): spms\src\main\resources\application.properties


To run, use : ".\mvnw.cmd spring-boot:run"

If the above one showed error use ".\mvnw.cmd clean spring-boot:run" and still error popped up check the connectivity, recheck the point 1 is valid on your system and you had installed all the requirenments
If insuffient memory occured as an error try to close all other background works and try to run again or restart your device.
If the error still hit understand the error and solve it throught some external help

http://localhost:<port_used>,  application will run on this