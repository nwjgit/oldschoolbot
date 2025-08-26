import { roll } from 'e';
import type { Bank } from 'oldschooljs';

import { clAdjustedDroprate } from '../bso/bsoUtil';
import { globalDroprates } from '../data/globalDroprates';

// user is null if tame is killing
export function handleSpecialCoxLoot(user: MUser | null, loot: Bank) {
	const takonDropRate = user
		? clAdjustedDroprate(user, 'Takon', globalDroprates.takon.baseRate, globalDroprates.takon.clIncrease)
		: globalDroprates.takon.tameBaseRate!;
	if (roll(takonDropRate)) {
		loot.add('Takon');
	}
	const steveDropRate = user
		? clAdjustedDroprate(user, 'Steve', globalDroprates.steve.baseRate, globalDroprates.steve.clIncrease)
		: globalDroprates.steve.tameBaseRate!;
	if (roll(steveDropRate)) {
		loot.add('Steve');
	}
	if (roll(140)) {
		loot.add('Clue scroll (grandmaster)');
	}
}
