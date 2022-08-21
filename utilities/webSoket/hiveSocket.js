const WebSocket = require('ws');
const EventEmitterHIVE = require('events').EventEmitter;
const jsonHelper = require('utilities/helpers/jsonHelper');

const HIVE_SOCKET = 'wss://blocks.waivio.com:8084';

const emitter = new EventEmitterHIVE();

class SocketClient {
  constructor(url) {
    this.url = url;
    this.newConnection();
  }

  newConnection() {
    this.ws = new WebSocket(this.url);

    this.ws.on('open', () => {
      console.info('socket connection open');
    });

    this.ws.on('error', () => {
      console.error('error socket closed');
      this.ws.close();
    });

    this.ws.on('message', (message) => {
      const data = jsonHelper.parseJson(message.toString());
      emitter.emit(data.id, { data: data.result, error: data.error });
    });
  }

  async sendMessage(message = {}) {
    return new Promise((resolve, reject) => {
      if (this.ws.readyState !== 1) {
        this.newConnection();
        resolve({ error: new Error('connection close') });
      }
      const id = this.getUniqId();
      message.id = id;
      this.ws.send(JSON.stringify(message));
      emitter.once(id, ({ data, error }) => {
        data
          ? resolve(data)
          : reject(error || new Error('Unexpected server response.'));
      });

      setTimeout(() => {
        reject(new Error('Timeout exceed'));
        emitter.off(id, resolve);
      }, 2 * 1000);
    });
  }

  getUniqId() {
    return `${Date.now().toString()}#${Math.random().toString(36).substr(2, 9)}`;
  }

  async getBlock(blockNum) {
    try {
      const result = await this.sendMessage({
        jsonrpc: '2.0',
        method: 'condenser_api.get_block',
        params: [blockNum],
      });
      return result;
    } catch (error) {
      return { error };
    }
  }

  async getOpsInBlock(blockNum) {
    try {
      const result = await this.sendMessage({
        jsonrpc: '2.0',
        method: 'account_history_api.get_ops_in_block',
        params: {
          block_num: blockNum,
          only_virtual: false,
        },
      });
      return result;
    } catch (error) {
      return { error };
    }
  }
}

const socketHiveClient = new SocketClient(HIVE_SOCKET);

module.exports = {
  socketHiveClient,
};
