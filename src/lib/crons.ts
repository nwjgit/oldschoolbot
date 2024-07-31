import { schedule } from 'node-cron';

import { analyticsTick } from './analytics';
<<<<<<< HEAD
=======
import { syncPrescence } from './doubleLoot';
>>>>>>> 63e3e808e6509fa2b31e85c1489acc044d9454e6
import { cacheGEPrices } from './marketPrices';
import { cacheCleanup } from './util/cachedUserIDs';
import { syncSlayerMaskLeaderboardCache } from './util/slayerMaskLeaderboard';

export function initCrons() {
	/**
	 * Capture economy item data
	 */
	schedule('0 */6 * * *', async () => {
		await prisma.$queryRawUnsafe(`INSERT INTO economy_item
SELECT item_id::integer, SUM(qty)::bigint FROM 
(
    SELECT id, (jdata).key AS item_id, (jdata).value::text::bigint AS qty FROM (select id, json_each(bank) AS jdata FROM users) AS banks
)
AS DATA
GROUP BY item_id;`);
	});

	/**
	 * Analytics
	 */
	schedule('*/5 * * * *', () => {
		debugLog('Analytics cronjob starting');
		return analyticsTick();
	});

	/**
	 * prescence
	 */
	schedule('0 * * * *', () => {
		syncPrescence();
	});

	/**
	 * Delete all voice channels
	 */
	schedule('0 0 */1 * *', async () => {
		cacheCleanup();
	});

<<<<<<< HEAD
=======
	schedule('0 0 * * *', async () => {
		syncSlayerMaskLeaderboardCache();
	});

>>>>>>> 63e3e808e6509fa2b31e85c1489acc044d9454e6
	schedule('35 */48 * * *', async () => {
		debugLog('cacheGEPrices cronjob starting');
		await cacheGEPrices();
	});
}
