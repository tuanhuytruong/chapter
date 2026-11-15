import { config } from '../config.js';
import { getPool } from '../db.js';
import { TelegramRepository } from './repository.js';
import { BotClient } from './client.js';
import { Outbox } from './outbox.js';
import { startTelegramRuntime } from './runtime-loop.js';
let instance: Outbox|null=null;
export function telegramService() {
 if(!config.telegramEnvironment||config.telegramEnvironment!==config.appEnv||!config.telegramBotToken)return null;
 if(!instance){const repo=new TelegramRepository(getPool(),config.telegramEnvironment);instance=new Outbox(repo,new BotClient(config.telegramBotToken,repo),config.telegramChapterOrigin,config.telegramSenderEnabled);}
 return instance;
}
export async function startTelegram() {
 return startTelegramRuntime(telegramService(),config.telegramSchedulerEnabled);
}
export { startTelegramRuntime } from './runtime-loop.js';
