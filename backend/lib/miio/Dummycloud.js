const dgram = require("dgram");
const Logger = require("../Logger");
const MiioUDPSocket = require("./MiioUDPSocket");

class Dummycloud {
    /**
     * @param {object} options
     * @param {string} options.spoofedIP The IP we've told miio we are
     * @param {Buffer} options.cloudSecret The pre-shared unique key of your robot
     * @param {number} options.deviceId The unique Device-id of your robot
     * @param {string} options.bindIP "127.0.0.1" on the robot, "0.0.0.0" in development
     * @param {() => void} options.onConnected  function to call after completing a handshake
     * @param {(msg: any) => boolean} options.onMessage  function to call for incoming messages
     */
    constructor(options) {
        this.spoofedIP = options.spoofedIP;
        this.bindIP = options.bindIP;

        this.socket = dgram.createSocket("udp4");

        this.socket.on("listening", () => {
            Logger.info("Dummycloud is spoofing " + this.spoofedIP + ":8053 on " + this.bindIP + ":" + Dummycloud.PORT);
        });

        this.socket.on("error", (e) => {
            Logger.error("DummyCloud Error: ", e);
        });

        this.socket.bind(Dummycloud.PORT, this.bindIP);


        this.miioUDPSocket = new MiioUDPSocket({
            socket: this.socket,
            token: options.cloudSecret,
            onMessage: this.handleMessage.bind(this),
            onConnected: options.onConnected,
            deviceId: options.deviceId,
            rinfo: undefined,
            timeout: 2000,
            name: "cloud",
            isServerSocket: true
        });

        this.onMessage = options.onMessage;
    }

    handleMessage(msg) {
        // some default handling.
        switch (msg.method) {
            case "_otc.info":
                this.miioUDPSocket.sendMessage({
                    "id": msg.id,
                    "result": {
                        "otc_list": [{"ip": this.spoofedIP, "port": Dummycloud.PORT}],
                        "otc_test": {
                            "list": [{"ip": this.spoofedIP, "port": Dummycloud.PORT}],
                            "interval": 1800,
                            "firsttest": 1193
                        }
                    }
                });
                return;
        }

        if (!this.onMessage(msg)) {
            //TODO: figure out why we're receiving "{"result":["ok"]}" messages
            if (Array.isArray(msg?.result) && msg.result[0] === "ok") {
                return;
            }


            Logger.info("Unknown cloud message received:", JSON.stringify(msg));

            //TODO: send default cloud ack!
        }
    }

    /**
     * Shutdown Dummycloud
     *
     * @returns {Promise<void>}
     */
    async shutdown() {
        await this.miioUDPSocket.shutdown();
    }
}
/**
 * @constant
 * The miio UDP port the dummycloud listens on.
 */
Dummycloud.PORT = 8053;

module.exports = Dummycloud;
