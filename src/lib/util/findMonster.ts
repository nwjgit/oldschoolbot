import killableMonsters from '../minions/data/killableMonsters';
import { KalphiteKingMonster } from '../minions/data/killableMonsters/custom/bosses/KalphiteKing';
import { Naxxus } from '../minions/data/killableMonsters/custom/bosses/Naxxus';
import { KillableMonster } from '../minions/types';
import { NexMonster } from '../nex';
import { stringMatches } from '../util';

export default function findMonster(str = ''): KillableMonster | undefined {
	// Ignecarus, KingGoldemar, VasaMagus aren't setup as KillableMonster
	const allMonsters: KillableMonster[] = [NexMonster, KalphiteKingMonster, Naxxus, ...killableMonsters];

	const mon = allMonsters.find(
		mon =>
			stringMatches(mon.id.toString(), str) ||
			stringMatches(mon.name, str) ||
			(mon.aliases && mon.aliases.some(alias => stringMatches(alias, str)))
	);

	console.log(mon);
	return mon;
}
