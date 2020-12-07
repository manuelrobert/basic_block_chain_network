# Basic-Block-Chain-Network<br>
### This is a very basic blockchain network build using hyperledger fabric 2.2.0 with the help of its binaries and samples. Before setting up the network follow https://hyperledger-fabric.readthedocs.io/en/release-2.2/prereqs.html for prerequisites and https://hyperledger-fabric.readthedocs.io/en/release-2.2/install.html to install hyperledeger fabric binaries and samples.
## Steps to setup the network:<br>
### 1.To start the network run <i>./network.sh up </i>.<br>
### 2.To create channel run <i>./network.sh createChannel </i>.<br>
### 3.To deploy chaincode run <i>./network.sh deployCC </i>.<br>
### 4.To stop the network run <i>./network.sh down </i>.<br>

## To integrate Hyperledger Explorer:<br>
### 1.From this directory run <i>cd explorer</i>.<br>
### 2.Run the docker file using the command <i>docker-compose up -d</i>.<br>
### 3.Then use a browser and open the link localhost:8080/
### 4. Use the id and password given in connection profile to login.
