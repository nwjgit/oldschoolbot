import { formatOrdinal } from '@oldschoolgg/toolkit';
import { bold } from 'discord.js';
import { isObject, randArrItem, Time, uniqueArr } from 'e';
import { Bank } from 'oldschooljs';
import { ItemBank } from 'oldschooljs/dist/meta/types';

import { drawChestLootImage } from '../../../lib/bankImage';
import { CHINCANNON_MESSAGES, Emoji, Events, toaPurpleItems } from '../../../lib/constants';
import { toaCL } from '../../../lib/data/CollectionsExport';
import { trackLoot } from '../../../lib/lootTrack';
import { getMinigameScore, incrementMinigameScore } from '../../../lib/settings/settings';
import { TeamLoot } from '../../../lib/simulation/TeamLoot';
import {
	calcTOALoot,
	calculateXPFromRaid,
	normalizeTOAUsers,
	toaOrnamentKits,
	toaPetTransmogItems
} from '../../../lib/simulation/toa';
import { TOAOptions } from '../../../lib/types/minions';
import { handleTripFinish } from '../../../lib/util/handleTripFinish';
import { assert } from '../../../lib/util/logError';
import resolveItems from '../../../lib/util/resolveItems';
import { userStatsBankUpdate, userStatsUpdate } from '../../../mahoji/mahojiSettings';

const purpleButNotAnnounced = resolveItems([
	"Elidinis' ward",
	"Osmumten's fang",
	'Lightbearer',
	'Masori mask',
	'Masori body',
	'Masori chaps'
]);

interface RaidResultUser {
	points: number;
	mUser: MUser;
	deaths: number;
	kc: number;
}

export const toaTask: MinionTask = {
	type: 'TombsOfAmascut',
	async run(data: TOAOptions) {
		const { channelID, raidLevel, duration, leader, quantity, wipedRoom: _wipedRoom, cc: chincannonUser } = data;
		const detailedUsers = normalizeTOAUsers(data);
		const wipedRooms = Array.isArray(_wipedRoom) ? _wipedRoom : [_wipedRoom];
		assert(Array.isArray(detailedUsers[0]) && isObject(detailedUsers[0][0]), `${detailedUsers}`);
		const isSolo = detailedUsers[0].length === 1;
		const allUsers = await Promise.all(detailedUsers[0].map(async u => mUserFetch(u.id)));
		const leaderSoloUser = allUsers[0];

		const previousCLs = allUsers.map(i => i.cl.clone());

		// Increment all users attempts
		await Promise.all(
			allUsers.map(i =>
				userStatsUpdate(
					i.id,
					{
						toa_attempts: {
							increment: quantity
						}
					},
					{}
				)
			)
		);
		if (wipedRooms.every(i => i !== null)) {
			return handleTripFinish(
				allUsers[0],
				channelID,
				`${allUsers.map(i => i.toString()).join(' ')} Your team wiped in the Tombs of Amascut!`,
				undefined,
				data,
				null,
				undefined
			);
		}

		const totalLoot = new TeamLoot(toaCL);

		const raidResults: Map<string, RaidResultUser> = new Map();
		for (const user of allUsers) {
			raidResults.set(user.id, {
				mUser: user,
				points: 0,
				deaths: 0,
				kc: await getMinigameScore(user.id, 'tombs_of_amascut')
			});
		}

		let messages: string[] = [];

		const itemsAddedTeamLoot = new TeamLoot();

		for (let x = 0; x < quantity; x++) {
			if (wipedRooms[x] !== null) continue;
			const raidLoot = calcTOALoot({
				users: detailedUsers[x].map(i => {
					const fullUser = allUsers.find(u => u.id === i.id)!;
					return {
						id: i.id,
						points: i.points,
						cl: fullUser.cl,
						kc: raidResults.get(i.id)!.kc,
						deaths: i.deaths
					};
				}),
				raidLevel
			});
			for (const { id, points, deaths } of detailedUsers[x]) {
				const currentUser = raidResults.get(id)!;
				currentUser.points += points;
				currentUser.deaths += deaths.length;
				currentUser.kc += 1;
				raidResults.set(id, currentUser);
			}
			for (const [userID, userLoot] of raidLoot.teamLoot.entries()) {
				totalLoot.add(userID, userLoot);
			}
			messages.push(...raidLoot.messages);
		}
		messages = uniqueArr(messages);
		const minigameIncrementResult = await Promise.all(
			allUsers.map(u => incrementMinigameScore(u.id, 'tombs_of_amascut', quantity))
		);

		let resultMessage = isSolo
			? `${leaderSoloUser}, your minion finished ${quantity === 1 ? 'a' : `${quantity}x`} Tombs of Amascut raid${
					quantity > 1 ? 's' : ''
			  }! Your KC is now ${minigameIncrementResult[0].newScore}.\n`
			: `<@${leader}> Your Raid${quantity > 1 ? 's have' : ' has'} finished.\n`;

		let shouldShowImage = allUsers.length <= 3 && totalLoot.entries().every(i => i[1].length <= 6);

		for (let [userID, userData] of raidResults.entries()) {
			const { points, deaths, mUser: user } = userData;

			// Increment the users total toa points
			await userStatsUpdate(
				user.id,
				{
					total_toa_points: {
						increment: points
					}
				},
				{}
			);

			// If the user already has these in their bank they cannot get another
			for (const itemID of [...toaPetTransmogItems, ...toaOrnamentKits.map(i => i[0].id)]) {
				const fullUser = allUsers.find(u => u.id === userID)!;
				const userLoot = totalLoot.get(userID);
				if (fullUser.bank.has(itemID) && userLoot.has(itemID)) {
					totalLoot.remove(user.id, itemID, userLoot.amount(itemID));
				}
			}

			let str: string = 'Nothing';
			if (!chincannonUser) {
				const { itemsAdded } = await transactItems({
					userID,
					itemsToAdd: totalLoot.get(userID),
					collectionLog: true
				});
				itemsAddedTeamLoot.add(userID, itemsAdded);
				const items = itemsAdded.items();

				const isPurple = items.some(([item]) => toaPurpleItems.includes(item.id));
				if (
					items.some(([item]) => toaPurpleItems.includes(item.id) && !purpleButNotAnnounced.includes(item.id))
				) {
					const itemsToAnnounce = itemsAdded.filter(item => toaPurpleItems.includes(item.id), false);
					globalClient.emit(
						Events.ServerNotification,
						`${Emoji.Purple} ${
							user.badgedUsername
						} just received **${itemsToAnnounce}** on their ${formatOrdinal(
							minigameIncrementResult[0].newScore
						)} raid.`
					);
				}
				str = isPurple ? `${Emoji.Purple} ||${itemsAdded}||` : itemsAdded.toString();
			}

			userStatsUpdate(
				user.id,
				u => {
					return {
						toa_raid_levels_bank: new Bank()
							.add(u.toa_raid_levels_bank as ItemBank)
							.add(raidLevel, quantity).bank,
						total_toa_duration_minutes: {
							increment: Math.floor(duration / Time.Minute)
						},
						toa_loot: !chincannonUser
							? new Bank(u.toa_loot as ItemBank).add(totalLoot.get(userID)).bank
							: undefined
					};
				},
				{}
			);

			const deathStr = deaths === 0 ? '' : new Array(deaths).fill(Emoji.Skull).join(' ');
			if (!chincannonUser) {
				if (shouldShowImage) {
					resultMessage += `\n${deathStr} **${user}** ${bold(points.toLocaleString())} points`;
				} else {
					resultMessage += `\n${deathStr} **${user}** received: ${str} (${bold(
						points.toLocaleString()
					)} points)`;
				}
			}

			const xpPromises = calculateXPFromRaid({
				realDuration: duration,
				fakeDuration: data.fakeDuration,
				user,
				raidLevel,
				teamSize: detailedUsers.length,
				points: raidResults.get(user.id)!.points
			});
			const xpStrings = await Promise.all(xpPromises);
			resultMessage += ` ${xpStrings.join(', ')}`;
		}

		if (messages.length > 0) {
			resultMessage += `\n\n${messages.join('\n')}`;
		}

		if (chincannonUser) {
			// log all the loot destroyed by chincannon
			await Promise.all(
				allUsers.map(user =>
					userStatsBankUpdate(
						user.id,
						'chincannon_destroyed_loot_bank',
						new Bank(totalLoot.get(user.id))
					).then(() => ({
						itemsAdded: new Bank()
					}))
				)
			);
			// Notify the user their loot was destroyed if using chincannon
			let msg = randArrItem(CHINCANNON_MESSAGES);
			resultMessage += `\n\n**${msg}**`;
			shouldShowImage = false;
		}

		const effectiveTotalLoot = chincannonUser ? new Bank() : totalLoot.totalLoot();
		await trackLoot({
			totalLoot: effectiveTotalLoot,
			id: 'tombs_of_amascut',
			type: 'Minigame',
			changeType: 'loot',
			duration,
			kc: quantity,
			users: allUsers.map(i => ({
				id: i.id,
				duration,
				loot: itemsAddedTeamLoot.get(i.id)
			}))
		});

		// Custom function for toa loot image that shows deaths and points
		function makeCustomTexts(userID: string) {
			const user = raidResults.get(userID)!;
			return [
				{
					text: `${user.points.toLocaleString()} points`,
					x: 149,
					y: 150
				},
				{
					text: `${user.deaths} deaths`,
					x: 149,
					y: 165
				}
			];
		}

		// Trip finish if solo
		if (isSolo) {
			return handleTripFinish(
				allUsers[0],
				channelID,
				resultMessage,
				shouldShowImage
					? await drawChestLootImage({
							entries: [
								{
									loot: itemsAddedTeamLoot.totalLoot(),
									user: allUsers[0],
									previousCL: previousCLs[0],
									customTexts: makeCustomTexts(leaderSoloUser.id)
								}
							],
							type: 'Tombs of Amascut'
					  })
					: undefined,
				data,
				itemsAddedTeamLoot.totalLoot()
			);
		}

		// Trip finish if not solo
		return handleTripFinish(
			allUsers[0],
			channelID,
			resultMessage,
			shouldShowImage
				? await drawChestLootImage({
						entries: allUsers.map((u, index) => ({
							loot: itemsAddedTeamLoot.get(u.id),
							user: u,
							previousCL: previousCLs[index],
							customTexts: makeCustomTexts(u.id)
						})),
						type: 'Tombs of Amascut'
				  })
				: undefined,
			data,
			null
		);
	}
};
