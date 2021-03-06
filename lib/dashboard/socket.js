'use strict';

const io = require('../server').io;
const settings = require('./settings');
const template = require('../template');


class Socket {
  constructor() {

    this.connected = false;

    io.on('connection', socket => {

      this.connected = true;

      socket.on('dashboard', async (type, data) => {

        const response = (err, res) => {
          if (err) return socket.emit('dashboard', 'response', true);
          socket.emit('dashboard', 'response', null, res);
        };

        let res;

        try {
          res = await this.parse(type, data);
        } catch (e) {
          response(true);
          return console.error(new Error(e));
        }

        response(null, res);

      });

      socket.on('disconnect', () => {
        this.connected = false;
      });

    });
  }

  emit(channel, data) {
    io.sockets.emit(channel, data);
  }

  async parse(type, data) {
    if (type === 'set') {

      settings.data = data;
      data.type = type;
      return data;

    } else if (type === 'function') {

      if (data.prop === 'template.search') {

        let result = {};

        try {
          result = await template.search();
        } catch (e) {
          return Promise.reject(e);
        }

        return {
          prop: data.prop,
          templates: result.templates,
          selected: result.selected
        };

      } else if (data.prop === 'template.set') {

        try {
          await template.set(data.value);
        } catch (e) {
          return Promise.reject(e);
        }

        return data;

      } else if (data.prop === 'notification.test') {

        const obj = {
          type: data.value,
          test: true
        };

        this.emit('notification', obj);

      } else if (data.prop === 'notification.cleanupQueue') {

        require('../notification').cleanupQueue();

        return data;
      }

    }
  }

}

const socket = new Socket();
module.exports = socket;
