'use strict';

const express = require('express');
const app = express();
const http = require('http');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');

const host = "localhost";
const port = "3000";

app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

http.createServer(app).listen(port, () => {
    console.log(`Server running at http://${host}:${port}`);
});



const FabricCAServices = require('fabric-ca-client');
const { Gateway, Wallets } = require('fabric-network');
const fs = require('fs');
// const path = require('path');

const getCCP = (org) => {
    let ccpPath;
    if (org == "Org1") {
        ccpPath = path.resolve(__dirname, '..', '..', 'Basic-Block-Chain-Network', 'organizations', 'peerOrganizations', 'org1.example.com', 'connection-org1.json');
    } else if (org == "Org2") {
        ccpPath = path.resolve(__dirname, '..', '..', 'Basic-Block-Chain-Network', 'organizations', 'peerOrganizations', 'org1.example.com', 'connection-org2.json');
    } else
        return null;
    const ccpJSON = fs.readFileSync(ccpPath, 'utf8');
    const ccp = JSON.parse(ccpJSON);
    return ccp;
};

const getCaUrl = async (org, ccp) => {
    let caURL;
    if (org == "Org1") {
        caURL = ccp.certificateAuthorities['ca.org1.example.com'].url;
    } else if (org == "Org2") {
        caURL = ccp.certificateAuthorities['ca.org2.example.com'].url;
    } else
        return null;
    return caURL;

}

const getWalletPath = async (org) => {
    let walletPath;
    if (org == "Org1") {
        walletPath = path.join(process.cwd(), 'org1-wallet');
    } else if (org == "Org2") {
        walletPath = path.join(process.cwd(), 'org2-wallet');
    } else
        return null;
    console.log(walletPath);
    return walletPath;
}

const getCaInfo = async (org, ccp) => {
    let caInfo
    if (org == "Org1") {
        caInfo = ccp.certificateAuthorities['ca.org1.example.com'];
    } else if (org == "Org2") {
        caInfo = ccp.certificateAuthorities['ca.org2.example.com'];
    } else
        return null
    return caInfo;
}

const enrollAdmin = async (org, ccp) => {
    try {
        const caInfo = await getCaInfo(org, ccp);
        const caTLSCACerts = caInfo.tlsCACerts.pem;
        const ca = new FabricCAServices(caInfo.url, { trustedRoots: caTLSCACerts, verify: false }, caInfo.caName);
        const walletPath = await getWalletPath(org);
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        const identity = await wallet.get('admin');
        if (identity) {
            console.log('An identity for the admin user "admin" already exists in the wallet');
            return;
        }

        const enrollment = await ca.enroll({ enrollmentID: 'admin', enrollmentSecret: 'adminpw' });
        let x509Identity;
        if (org == "Org1") {
            x509Identity = {
                credentials: {
                    certificate: enrollment.certificate,
                    privateKey: enrollment.key.toBytes(),
                },
                mspId: 'Org1MSP',
                type: 'X.509',
            };
        } else if (org == "Org2") {
            x509Identity = {
                credentials: {
                    certificate: enrollment.certificate,
                    privateKey: enrollment.key.toBytes(),
                },
                mspId: 'Org2MSP',
                type: 'X.509',
            };
        }

        await wallet.put('admin', x509Identity);
        console.log('Successfully enrolled admin user "admin" and imported it into the wallet');
        return;
    } catch (error) {
        console.error(`Failed to enroll admin user "admin": ${error}`);
    }
};

const getAffiliation = async (org) => {
    return org == "Org1" ? 'org1.department1' : 'org2.department1'
}

const getRegisteredUser = async (username, userOrg) => {
    let ccp = await getCCP(userOrg);
    const caURL = await getCaUrl(userOrg, ccp);
    const ca = new FabricCAServices(caURL);
    const walletPath = await getWalletPath(userOrg);
    const wallet = await Wallets.newFileSystemWallet(walletPath);
    console.log(`Wallet path: ${walletPath}`);
    console.log("hhh");

    const userIdentity = await wallet.get(username);
    if (userIdentity) {
        console.log(`An identity for the user ${username} already exists in the wallet`);
        return {
            success: true,
            message: username + ' enrolled Successfully',
        };
    }

    let adminIdentity = await wallet.get('admin');
    if (!adminIdentity) {
        console.log('An identity for the admin user "admin" does not exist in the wallet');
        await enrollAdmin(userOrg, ccp);
        adminIdentity = await wallet.get('admin');
        console.log("Admin Enrolled Successfully");
    }

    const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
    const adminUser = await provider.getUserContext(adminIdentity, 'admin');
    let secret;
    try {
        secret = await ca.register({ affiliation: await getAffiliation(userOrg), enrollmentID: username, role: 'client' }, adminUser);
    } catch (error) {
        return error.message
    }

    const enrollment = await ca.enroll({ enrollmentID: username, enrollmentSecret: secret });

    let x509Identity;
    if (userOrg == "Org1") {
        x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: 'Org1MSP',
            type: 'X.509',
        };
    } else if (userOrg == "Org2") {
        x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: 'Org2MSP',
            type: 'X.509',
        };
    }

    await wallet.put(username, x509Identity);
    console.log(`Successfully registered and enrolled admin user ${username} and imported it into the wallet`);

    var response = {
        success: true,
        message: username + ' enrolled Successfully',
    };
    return response;
};

function getErrorMessage(field) {
    var response = {
        success: false,
        message: field + ' field is missing or Invalid in the request'
    };
    return response;
}

app.post('/users', async (req, res) => {

    if (!req.body.username) {
        res.json(getErrorMessage('\'username\''));
        return;
    }
    if (!req.body.orgName) {
        res.json(getErrorMessage('\'orgName\''));
        return;
    }
    let response = await getRegisteredUser(req.body.username, req.body.orgName);
    if (response && typeof response !== 'string') {
        res.json(response);
    } else {
        res.json({ success: false, message: response });
    }
});


const { TxEventHandler, GatewayOptions, DefaultEventHandlerStrategies, TxEventHandlerFactory } = require('fabric-network');//only commented needed when refactoring
// const { Gateway, Wallets, TxEventHandler, GatewayOptions, DefaultEventHandlerStrategies, TxEventHandlerFactory } = require('fabric-network');
// const fs = require('fs');
// const path = require("path");

const invokeTransaction = async (channelName, chaincodeName, fcn, args, username, org_name) => {
    try {
        const ccp = await getCCP(org_name);
        const walletPath = await getWalletPath(org_name);
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        let identity = await wallet.get(username);
        if (!identity) {
            console.log(`An identity for the user ${username} does not exist in the wallet, so registering user`);
            await getRegisteredUser(username, org_name, true);
            identity = await wallet.get(username);
            console.log('Run the registerUser.js application before retrying');
            return;
        }

        const connectOptions = {
            wallet, identity: username, discovery: { enabled: true, asLocalhost: true },
        };

        const gateway = new Gateway();
        await gateway.connect(ccp, connectOptions);

        const network = await gateway.getNetwork(channelName);

        const contract = network.getContract(chaincodeName);

        let result;
        let message;
        if (fcn === "createCar" ) {
            result = await contract.submitTransaction(fcn, args[0], args[1], args[2], args[3], args[4]);
            message = `Successfully added the car asset with key ${args[0]}`;
        } else if (fcn === "changeCarOwner") {
            result = await contract.submitTransaction(fcn, args[0], args[1]);
            message = `Successfully changed car owner with key ${args[0]}`;
        } else {
            return `Invocation require either createCar or changeCarOwner as function but got ${fcn}`;
        }

        await gateway.disconnect();

        console.log("type", typeof(result));

        let response = {
            message: message,
            result
        };
        return response;
    } catch (error) {
        console.log(`Getting error: ${error}`);
        console.log("error", error)
        return error.message;

    }
}

app.post('/channel/:channelName/chaincode/:chaincodeName', async (req, res) => {
    console.log("In invoke", req.body);
    try {
        var chaincodeName = req.params.chaincodeName;
        var channelName = req.params.channelName;
        var fcn = req.body.fcn;
        var args = req.body.args;
        if (!chaincodeName) {
            res.json(getErrorMessage('\'chaincodeName\''));
            return;
        }
        if (!channelName) {
            res.json(getErrorMessage('\'channelName\''));
            return;
        }
        if (!fcn) {
            res.json(getErrorMessage('\'fcn\''));
            return;
        }
        if (!args) {
            res.json(getErrorMessage('\'args\''));
            return;
        }
        let message = await invokeTransaction(channelName, chaincodeName, fcn, args, req.body.username, req.body.orgname);
        console.log(`message result is : ${message}`);
        const response_payload = {
            result: message,
            error: null,
            errorData: null
        }
        res.send(response_payload);
    } catch (error) {
        const response_payload = {
            result: null,
            error: error.name,
            errorData: error.message
        }
        res.send(response_payload)
    }
});



const query = async (channelName, chaincodeName, args, fcn, username, org_name) => {
    try {
        const ccp = await getCCP(org_name);
        const walletPath = await getWalletPath(org_name);
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        let identity = await wallet.get(username);
        if (!identity) {
            console.log(`An identity for the user ${username} does not exist in the wallet, so registering user`);
            await getRegisteredUser(username, org_name, true)
            identity = await wallet.get(username);
            console.log('Run the registerUser.js application before retrying');
            return;
        }

        const gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet, identity: username, discovery: { enabled: true, asLocalhost: true }
        });

        const network = await gateway.getNetwork(channelName);

        const contract = network.getContract(chaincodeName);
        let result;

        if (fcn == "queryCar") {
            result = await contract.evaluateTransaction(fcn, args[0]);
        } else if (fcn == "readPrivateCar" || fcn == "queryPrivateDataHash"
        || fcn == "collectionCarPrivateDetails") {
            result = await contract.evaluateTransaction(fcn, args[0], args[1]);
        }
        console.log(result)
        console.log(`Transaction has been evaluated, result is: ${result}`);

        // result = JSON.parse(result.toString());
        return result
    } catch (error) {
        console.error(`Failed to evaluate transaction: ${error}`);
        return error.message

    }
}

app.get('/channel/:channelName/chaincode/:chaincodeName', async function (req, res) {
    try {
        var channelName = req.params.channelName;
        var chaincodeName = req.params.chaincodeName;
        console.log(`chaincode name is :${chaincodeName}`)
        let args = req.query.args;
        let fcn = req.query.fcn;
        if (!chaincodeName) {
            res.json(getErrorMessage('\'chaincodeName\''));org1
            res.json(getErrorMessage('\'channelName\''));
            return;
        }
        if (!fcn) {
            res.json(getErrorMessage('\'fcn\''));
            return;
        }
        if (!args) {
            res.json(getErrorMessage('\'args\''));
            return;
        }
        console.log('args==========', args);
        args = args.replace(/'/g, '"');
        args = JSON.parse(args);
        let message = await query(channelName, chaincodeName, args, fcn, req.body.username, req.body.orgname);
        const response_payload = {
            result: message,
            error: null,
            errorData: null
        }
        res.send(response_payload);
    } catch (error) {
        const response_payload = {
            result: null,
            error: error.name,
            errorData: error.message
        }
        res.send(response_payload)
    }
});
