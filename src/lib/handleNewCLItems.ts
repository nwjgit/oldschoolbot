import { formatOrdinal, roboChimpCLRankQuery } from '@oldschoolgg/toolkit';
import type { Prisma } from '@prisma/client';
import { UserEventType } from '@prisma/client';
import { roll, sumArr } from 'e';
import type { Bank } from 'oldschooljs';

import { Events } from './constants';
import { allCLItems, allCollectionLogsFlat, calcCLDetails } from './data/Collections';
import { calculateMastery } from './mastery';
import { calculateOwnCLRanking, roboChimpSyncData } from './roboChimp';

import { RawSQL } from './rawSql';
import { MUserStats } from './structures/MUserStats';
import { fetchCLLeaderboard } from './util/clLeaderboard';
import { insertUserEvent } from './util/userEvents';

async function createHistoricalData(user: MUser): Promise<Prisma.HistoricalDataUncheckedCreateInput> {
	const clStats = calcCLDetails(user);
	const clRank = await roboChimpClient.$queryRawUnsafe<{ count: number }[]>(roboChimpCLRankQuery(BigInt(user.id)));
	const { totalMastery } = await calculateMastery(user, await MUserStats.fromID(user.id));

	return {
		user_id: user.id,
		GP: user.GP,
		total_xp: sumArr(Object.values(user.skillsAsXP)),
		cl_completion_percentage: clStats.percent,
		cl_completion_count: clStats.owned.length,
		cl_global_rank: Number(clRank[0].count),
		mastery_percentage: totalMastery
	};
}

export async function handleNewCLItems({
	itemsAdded,
	user,
	previousCL,
	newCL
}: {
	user: MUser;
	previousCL: Bank;
	newCL: Bank;
	itemsAdded: Bank;
}) {
	console.log('INSIDE handleNewCLItems 1');
	const newCLItems = itemsAdded
		?.clone()
		.filter(i => !previousCL.has(i.id) && newCL.has(i.id) && allCLItems.includes(i.id));
	console.log('INSIDE handleNewCLItems 2');
	const didGetNewCLItem = newCLItems && newCLItems.length > 0;
	if (didGetNewCLItem || roll(30)) {
		await prisma.historicalData.create({ data: await createHistoricalData(user) });
	}
	console.log('INSIDE handleNewCLItems 3');
	if (didGetNewCLItem) {
		await prisma.$queryRawUnsafe(RawSQL.updateCLArray(user.id));
	}
	console.log('INSIDE handleNewCLItems 4');
	if (!didGetNewCLItem) return;
	console.log('INSIDE handleNewCLItems 5');
	const previousCLDetails = calcCLDetails(previousCL);
	const previousCLRank = previousCLDetails.percent >= 80 ? await calculateOwnCLRanking(user.id) : null;
	console.log('INSIDE handleNewCLItems 6');
	await roboChimpSyncData(user, newCL);
	const newCLRank = previousCLDetails.percent >= 80 ? await calculateOwnCLRanking(user.id) : null;
	console.log('INSIDE handleNewCLItems 7');
	const newCLDetails = calcCLDetails(newCL);
	console.log('INSIDE handleNewCLItems 8');
	let newCLPercentMessage: string | null = null;
	console.log('INSIDE handleNewCLItems 9');
	const milestonePercentages = [25, 50, 70, 80, 90, 95, 100];
	for (const milestone of milestonePercentages) {
		if (previousCLDetails.percent < milestone && newCLDetails.percent >= milestone) {
			newCLPercentMessage = `${user} just reached ${milestone}% Collection Log completion, after receiving ${newCLItems}!`;

			if (previousCLRank !== newCLRank && newCLRank !== null && previousCLRank !== null) {
				newCLPercentMessage += ` In the overall CL leaderboard, they went from rank ${previousCLRank} to rank ${newCLRank}.`;
			}
		}
		break;
	}
	console.log('INSIDE handleNewCLItems 10');
	if (newCLPercentMessage) {
		globalClient.emit(Events.ServerNotification, newCLPercentMessage);
	}
	console.log('INSIDE handleNewCLItems 11');
	const clsWithTheseItems = allCollectionLogsFlat.filter(
		cl => cl.counts !== false && newCLItems.items().some(([newItem]) => cl.items.includes(newItem.id))
	);
	console.log('INSIDE handleNewCLItems 12');
	// Find CLs with the newly added items, that weren't completed in the previous CL, and now are completed.
	const newlyCompletedCLs = clsWithTheseItems.filter(cl => {
		return cl.items.some(item => !previousCL.has(item)) && cl.items.every(item => newCL.has(item));
	});
	console.log('INSIDE handleNewCLItems 13');
	for (const finishedCL of newlyCompletedCLs) {
		await insertUserEvent({
			userID: user.id,
			type: UserEventType.CLCompletion,
			collectionLogName: finishedCL.name
		});
		console.log('INSIDE handleNewCLItems 13.1');
		const kcString = finishedCL.fmtProg
			? `They finished after... ${await finishedCL.fmtProg({
					getKC: (id: number) => user.getKC(id),
					user,
					minigames: await user.fetchMinigames(),
					stats: await MUserStats.fromID(user.id)
				})}!`
			: '';
		console.log('INSIDE handleNewCLItems 13.2');

		const leaderboardUsers = await fetchCLLeaderboard({
			ironmenOnly: false,
			items: finishedCL.items,
			resultLimit: 100_000,
			clName: finishedCL.name
		});
		console.log('INSIDE handleNewCLItems 14');
		const nthUser = leaderboardUsers.users.filter(u => u.qty === finishedCL.items.length).length;

		const placeStr = nthUser > 100 ? '' : ` They are the ${formatOrdinal(nthUser)} user to finish this CL.`;
		console.log('INSIDE handleNewCLItems 15');
		globalClient.emit(
			Events.ServerNotification,
			`${user.badgedUsername} just finished the ${finishedCL.name} collection log!${placeStr} ${kcString}`
		);
	}
}
