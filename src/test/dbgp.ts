import {DbgpConnection, ENCODING} from '../dbgp';
import {Socket} from 'net';
import * as iconv from 'iconv-lite';
import chai from 'chai';
const assert = chai.assert;

describe('DbgpConnection', () => {

    function makePacket(message: string): Buffer {
        const messageBuffer = iconv.encode(message, ENCODING);
        return Buffer.concat([new Buffer(messageBuffer.length + '\0'), messageBuffer, new Buffer('\0')]);
    }

    const message = '<?xml version="1.0" encoding="iso-8859-1"?>\n<init xmlns="urn:debugger_protocol_v1" xmlns:xdebug="http://xdebug.org/dbgp/xdebug">This is just a test</init>';
    const packet = makePacket(message);

    let socket: Socket;
    let conn: DbgpConnection;
    beforeEach(() => {
        socket = new Socket();
        conn = new DbgpConnection(socket);
    });

    it('should parse a response in one data event', done => {
        conn.on('message', (document: XMLDocument) => {
            assert.equal(document.documentElement.nodeName, 'init');
            assert.equal(document.documentElement.textContent, 'This is just a test');
            done();
        });
        conn.on('warning', done);
        conn.on('error', done);
        setTimeout(() => {
            socket.emit('data', packet);
        }, 100);
    });

    it('should parse a response over multiple data events', done => {
        conn.on('message', (document: XMLDocument) => {
            assert.equal(document.documentElement.nodeName, 'init');
            assert.equal(document.documentElement.textContent, 'This is just a test');
            done();
        });
        conn.on('warning', done);
        conn.on('error', done);
        const part1 = packet.slice(0, 50);
        const part2 = packet.slice(50, 100);
        const part3 = packet.slice(100);
        setTimeout(() => {
            socket.emit('data', part1);
            setTimeout(() => {
                socket.emit('data', part2);
                setTimeout(() => {
                    socket.emit('data', part3);
                }, 100);
            }, 100);
        }, 100);
    });

    it('should error on invalid XML', () => new Promise((resolve, reject) => {
        conn.on('error', (error: Error) => {
            assert.isDefined(error);
            assert.instanceOf(error, Error);
            resolve();
        });
        conn.once('message', (document: XMLDocument) => {
            reject(new Error('emitted message event'));
        });
        socket.emit('data', makePacket('<</<<><>>><?><>'));
    }));
});