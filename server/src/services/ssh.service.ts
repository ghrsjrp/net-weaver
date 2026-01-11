import { Client, ConnectConfig } from 'ssh2';

export interface SSHConnectionOptions {
  host: string;
  port: number;
  username: string;
  password: string;
  timeout?: number;
  keepaliveInterval?: number;
}

export interface SSHCommandResult {
  success: boolean;
  output: string;
  error?: string;
}

export class SSHService {
  private client: Client | null = null;
  private connected: boolean = false;
  private timeout: number;
  private keepaliveInterval: number;

  constructor() {
    this.timeout = parseInt(process.env.SSH_TIMEOUT || '30000', 10);
    this.keepaliveInterval = parseInt(process.env.SSH_KEEPALIVE_INTERVAL || '10000', 10);
  }

  async connect(options: SSHConnectionOptions): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.client = new Client();

      const config: ConnectConfig = {
        host: options.host,
        port: options.port || 22,
        username: options.username,
        password: options.password,
        readyTimeout: options.timeout || this.timeout,
        keepaliveInterval: options.keepaliveInterval || this.keepaliveInterval,
        algorithms: {
          kex: [
            'ecdh-sha2-nistp256',
            'ecdh-sha2-nistp384',
            'ecdh-sha2-nistp521',
            'diffie-hellman-group-exchange-sha256',
            'diffie-hellman-group14-sha256',
            'diffie-hellman-group14-sha1',
            'diffie-hellman-group1-sha1',
          ],
          cipher: [
            'aes128-ctr',
            'aes192-ctr',
            'aes256-ctr',
            'aes128-gcm@openssh.com',
            'aes256-gcm@openssh.com',
            'aes256-cbc',
            'aes128-cbc',
            '3des-cbc',
          ],
          serverHostKey: [
            'ssh-rsa',
            'ecdsa-sha2-nistp256',
            'ecdsa-sha2-nistp384',
            'ecdsa-sha2-nistp521',
            'ssh-ed25519',
            'rsa-sha2-256',
            'rsa-sha2-512',
          ],
          hmac: [
            'hmac-sha2-256',
            'hmac-sha2-512',
            'hmac-sha1',
          ],
        },
      };

      const connectionTimeout = setTimeout(() => {
        this.disconnect();
        reject(new Error(`Connection timeout after ${this.timeout}ms`));
      }, this.timeout);

      this.client.on('ready', () => {
        clearTimeout(connectionTimeout);
        this.connected = true;
        console.log(`SSH connected to ${options.host}:${options.port}`);
        resolve(true);
      });

      this.client.on('error', (err) => {
        clearTimeout(connectionTimeout);
        console.error(`SSH connection error: ${err.message}`);
        this.connected = false;
        reject(err);
      });

      this.client.on('close', () => {
        this.connected = false;
        console.log('SSH connection closed');
      });

      this.client.connect(config);
    });
  }

  async executeCommand(command: string, timeout: number = 30000): Promise<SSHCommandResult> {
    if (!this.client || !this.connected) {
      return {
        success: false,
        output: '',
        error: 'Not connected to SSH server',
      };
    }

    return new Promise((resolve) => {
      let output = '';
      let errorOutput = '';
      let commandTimeout: NodeJS.Timeout;

      this.client!.exec(command, { pty: true }, (err, stream) => {
        if (err) {
          resolve({
            success: false,
            output: '',
            error: err.message,
          });
          return;
        }

        commandTimeout = setTimeout(() => {
          stream.close();
          resolve({
            success: false,
            output,
            error: `Command timeout after ${timeout}ms`,
          });
        }, timeout);

        stream.on('close', () => {
          clearTimeout(commandTimeout);
          resolve({
            success: true,
            output: output.trim(),
            error: errorOutput || undefined,
          });
        });

        stream.on('data', (data: Buffer) => {
          output += data.toString();
        });

        stream.stderr.on('data', (data: Buffer) => {
          errorOutput += data.toString();
        });
      });
    });
  }

  async executeCommands(commands: string[]): Promise<SSHCommandResult[]> {
    const results: SSHCommandResult[] = [];
    
    for (const command of commands) {
      const result = await this.executeCommand(command);
      results.push(result);
      
      // Small delay between commands to avoid overwhelming the device
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return results;
  }

  disconnect(): void {
    if (this.client) {
      this.client.end();
      this.client = null;
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}

export default SSHService;
