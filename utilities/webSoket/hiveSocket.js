const WebSocket = require('ws');
const EventEmitterHIVE = require('events').EventEmitter;
const jsonHelper = require('utilities/helpers/jsonHelper');
const _ = require('lodash');

const HIVE_SOCKET = 'wss://blocks.waivio.com:8084';

const emitter = new EventEmitterHIVE();

/**
 * Not using reject in order not to wrap an instance of the class in a try catch
 */
class SocketClient {
  constructor(url) {
    this.url = url;
  }

  async init() {
    return new Promise((resolve) => {
      this.ws = new WebSocket(this.url);

      this.ws.on('error', () => {
        console.error('error socket closed');
        this.ws.close();
        resolve({ error: new Error('error socket closed') });
      });

      this.ws.on('message', (message) => {
        const data = jsonHelper.parseJson(message.toString());
        emitter.emit(data.id, { data, error: data.error });
      });

      this.ws.on('open', () => {
        setTimeout(() => {
          console.info('socket connection open');
          resolve(this.ws);
        }, 100);
      });
    });
  }

  async sendMessage(message = {}) {
    if (process.env.SOCKET_HIVE !== 'true') return { error: new Error('socket disabled') };
    if (_.get(this, 'ws.readyState') !== 1) {
      await this.init();
    }
    return new Promise((resolve) => {
      if (this.ws.readyState !== 1) {
        resolve({ error: new Error('connection close') });
      }

      const id = this.getUniqId();
      message.id = id;
      this.ws.send(JSON.stringify(message));
      emitter.once(id, ({ data, error }) => {
        if (error) resolve({ error: new Error('Unexpected server response.') });
        resolve(data);
      });

      setTimeout(() => {
        resolve({ error: new Error('Timeout exceed') });
        emitter.off(id, resolve);
      }, 2 * 1000);
    });
  }

  getUniqId() {
    return `${Date.now().toString()}#${Math.random().toString(36).substr(2, 9)}`;
  }

  async getBlock(blockNum) {
    const data = await this.sendMessage({
      jsonrpc: '2.0',
      method: 'condenser_api.get_block',
      params: [blockNum],
    });
    if (_.get(data, 'error')) {
      return { error: data.error };
    }
    return data.result;
  }

  async getOpsInBlock(blockNum) {
    const data = await this.sendMessage({
      jsonrpc: '2.0',
      method: 'account_history_api.get_ops_in_block',
      params: {
        block_num: blockNum,
        only_virtual: false,
      },
    });
    if (_.get(data, 'error')) {
      return { error: data.error };
    }
    return data.result;
  }

  async getAccounts(accounts = []) {
    const data = await this.sendMessage({
      jsonrpc: '2.0',
      method: 'condenser_api.get_accounts',
      params: [accounts],
      id: 1,
    });
    if (_.get(data, 'error')) {
      return { error: data.error };
    }
    return data.result;
  }
}

const socketHiveClient = new SocketClient(HIVE_SOCKET);

module.exports = {
  socketHiveClient,
};
