import type { INestApplicationContext } from '@nestjs/common'
import type { ServerOptions } from 'socket.io'

import { IoAdapter } from '@nestjs/platform-socket.io'

import { ConfigService } from './config/config.service.js'

export class SocketIOAdapter extends IoAdapter {
  constructor(
    private readonly app: INestApplicationContext,
    private readonly configService: ConfigService,
  ) {
    super(app)
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const basePath = this.configService.basePath
    const path = basePath ? `${basePath}/socket.io` : '/socket.io'

    const serverOptions: ServerOptions = {
      ...options,
      path,
    }

    return super.createIOServer(port, serverOptions)
  }
}
