import type {TelegramRepository} from './repository.js';
/** Retain metadata dedupe ledger, never content indefinitely. Do not drop ledger rows. */
export async function cleanup(repo:TelegramRepository){
 await repo.transaction(async c=>{
  // Book moved to another owner is no longer authorized; deletion is FK-cascaded.
  await c.query(`UPDATE chapter.telegram_delivery_parts p SET html=NULL,state=CASE WHEN p.state='pending' THEN 'canceled' ELSE p.state END FROM chapter.telegram_deliveries d WHERE p.environment=$1 AND d.environment=p.environment AND d.id=p.delivery_id AND (d.created_at<now()-interval '7 days' AND d.state IN ('sent','canceled','expired','failed','unknown') OR d.state IN ('canceled','expired') OR NOT EXISTS(SELECT 1 FROM chapter.books b WHERE b.id=d.book_id AND b.owner_id=d.owner_id AND b.status='active') OR NOT EXISTS(SELECT 1 FROM chapter.telegram_destinations dest JOIN chapter.telegram_identities i ON i.environment=dest.environment AND i.id=dest.identity_id AND i.revoked_at IS NULL JOIN chapter.telegram_subscriptions s ON s.environment=dest.environment AND s.destination_id=dest.id AND s.enabled JOIN chapter.telegram_book_grants g ON g.environment=dest.environment AND g.destination_id=dest.id AND g.book_id=d.book_id AND g.revoked_at IS NULL WHERE dest.environment=d.environment AND dest.id=d.destination_id AND dest.manager_user_id=d.owner_id AND dest.state='active'))`,[repo.environment]);
  await c.query("DELETE FROM chapter.telegram_link_requests WHERE environment=$1 AND expires_at<now()-interval '1 day'",[repo.environment]);
  await c.query("DELETE FROM chapter.telegram_webhook_updates WHERE environment=$1 AND created_at<now()-interval '7 days'",[repo.environment]);
 });
}
