import { Time } from 'e';
import { Bank } from 'oldschooljs';

import { prisma } from '../../../lib/settings/prisma';
import type { ActivityTaskOptionsWithNoChanges } from '../../../lib/types/minions';
import { randomVariation } from '../../../lib/util';
import addSubTaskToActivityTask from '../../../lib/util/addSubTaskToActivityTask';

export async function strongHoldOfSecurityCommand(user: MUser, channelID: string) {
	if (user.minionIsBusy) {
		return 'Your minion is busy.';
	}
	const count = await prisma.activity.count({
		where: {
			user_id: BigInt(user.id),
			type: 'StrongholdOfSecurity'
		}
	});
	const missingBoots = new Bank();
	if (count !== 0) {
		if (!user.bank.has('Fancy boots')) {
			missingBoots.add('Fancy boots');
		}
		if (!user.bank.has('Fighting boots')) {
			missingBoots.add('Fighting boots');
		}
		if (!user.bank.has('Fancier boots')) {
			missingBoots.add('Fancier boots');
		}
		if (missingBoots.items.length > 0) {
			await transactItems({ userID: user.id, itemsToAdd: missingBoots });
			const addedBoots = missingBoots.items().map(item => item[0].name);

			return addedBoots.length > 0
				? `You've already completed the Stronghold of Security! Added missing boots: ${addedBoots.join(', ')}`
				: "You've already completed the Stronghold of Security!";
		}
	}

	await addSubTaskToActivityTask<ActivityTaskOptionsWithNoChanges>({
		userID: user.id,
		channelID: channelID.toString(),
		duration: randomVariation(Time.Minute * 10, 5),
		type: 'StrongholdOfSecurity'
	});

	return `${user.minionName} is now doing the Stronghold of Security!`;
}
