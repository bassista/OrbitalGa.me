import {GameConstants} from '@common/game/gameConstants';
import {ClientConfig} from './clientConfig';
import {ArrayBufferSchemaBuilder} from '@common/parsers/arrayBufferSchemaBuilder';
import {ServerToClientMessage, ServerToClientSchemaReaderFunction} from '@common/models/serverToClientMessages';
import {ClientToServerMessage, ClientToServerSchemaAdderFunction} from '@common/models/clientToServerMessages';

export class ClientSocket implements IClientSocket {
  private socket?: WebSocket;
  connect(
    serverPath: string,
    options: {
      onDisconnect: () => void;
      onMessage: (messages: ServerToClientMessage[]) => void;
      onOpen: () => void;
    }
  ) {
    let totalLength = 0;
    this.socket = new WebSocket(ClientConfig.websocketUrl(serverPath));
    this.socket.binaryType = 'arraybuffer';
    this.socket.onopen = () => {
      options.onOpen();
      console.count('opened');
    };
    this.socket.onerror = (e) => {
      // console.log(e.toString());
      console.log(JSON.stringify(e, null, 2));
      this.socket?.close();
      options.onDisconnect();
    };
    this.socket.onmessage = (e) => {
      if (GameConstants.binaryTransport) {
        totalLength += (e.data as ArrayBuffer).byteLength;
        options.onMessage(ArrayBufferSchemaBuilder.startReadSchemaBuffer(e.data, ServerToClientSchemaReaderFunction));
      } else {
        totalLength += e.data.length;
        options.onMessage(JSON.parse(e.data));
      }
      // console.log((totalLength / 1024).toFixed(2) + 'kb');
    };
    this.socket.onclose = () => {
      options.onDisconnect();
    };
  }

  disconnect() {
    this.socket?.close();
  }

  isConnected(): boolean {
    return !!this.socket && this.socket.readyState === this.socket.OPEN;
  }

  sendMessage(message: ClientToServerMessage) {
    if (GameConstants.binaryTransport) {
      this.socketSend(ArrayBufferSchemaBuilder.startAddSchemaBuffer(message, ClientToServerSchemaAdderFunction));
    } else {
      this.socketSend(JSON.stringify(message));
    }
  }
  private socketSend(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
    if (!this.socket) {
      throw new Error('Not connected');
    }
    try {
      if (GameConstants.throttleClient) {
        setTimeout(() => {
          this.socket!.send(data);
        }, 400);
      } else {
        this.socket.send(data);
      }
    } catch (ex) {
      console.error('disconnected??', ex);
    }
  }
}

export interface IClientSocket {
  connect(
    serverPath: string,
    options: {
      onDisconnect: () => void;
      onMessage: (messages: ServerToClientMessage[]) => void;
      onOpen: () => void;
    }
  ): void;
  disconnect(): void;
  isConnected(): boolean;
  sendMessage(message: ClientToServerMessage): void;
}
