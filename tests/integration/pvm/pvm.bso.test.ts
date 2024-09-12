import { Bank, EMonster } from 'oldschooljs';
import { describe, expect, it } from 'vitest';

import { Time } from 'e';
import { SkillsEnum } from 'oldschooljs/dist/constants';
import type { ItemBank } from 'oldschooljs/dist/meta/types';
import { CombatCannonItemBank } from '../../../src/lib/minions/data/combatConstants';
import { BSOMonsters } from '../../../src/lib/minions/data/killableMonsters/custom/customMonsters';
import { Gear } from '../../../src/lib/structures/Gear';
import { itemID, resolveItems } from '../../../src/lib/util';
import { mockClient } from '../util';

describe('BSO PVM', async () => {
	const client = await mockClient();

	it('cant barrage off task', async () => {
		const user = await client.mockUser({
			slayerLevel: 99,
			bank: new Bank().add('Blood rune', 1000).add('Death rune', 1000).add('Water rune', 10000000),
			mageLevel: 99,
			mageGear: resolveItems(['Ancient staff'])
		});
		const result = await user.kill(EMonster.ABYSSAL_DEMON, { method: 'barrage' });
		expect(result.xpGained.magic).toEqual(0);
		expect(result.commandResult).not.toContain('Barrage');
		expect(result.newKC).toEqual(0);
	});

	it('can barrage on task', async () => {
		const user = await client.mockUser({
			slayerLevel: 99,
			bank: new Bank().add('Blood rune', 1000).add('Death rune', 1000).add('Water rune', 10000000),
			mageLevel: 99,
			mageGear: resolveItems(['Ancient staff'])
		});
		await user.giveSlayerTask(EMonster.ABYSSAL_DEMON);
		const result = await user.kill(EMonster.ABYSSAL_DEMON, { method: 'barrage' });
		expect(result.xpGained.magic).toBeGreaterThan(0);
		expect(result.commandResult).toContain('Barrage');
		expect(result.newKC).toBeGreaterThan(0);
	});

	it('barrages abby demons if on task', async () => {
		const user = await client.mockUser({
			slayerLevel: 99,
			bank: new Bank().add('Blood rune', 1000).add('Death rune', 1000).add('Water rune', 10000000),
			mageLevel: 99,
			mageGear: resolveItems(['Ancient staff'])
		});
		await user.giveSlayerTask(EMonster.ABYSSAL_DEMON);
		const result = await user.kill(EMonster.ABYSSAL_DEMON, { method: 'barrage' });
		expect(result.xpGained.magic).toBeGreaterThan(0);
		expect(user.bank.amount('Blood rune')).toBeLessThan(1000);
		expect(user.bank.amount('Water rune')).toBeLessThan(10000000);
		expect(user.bank.amount('Death rune')).toBeLessThan(1000);
		expect(result.commandResult).toContain('is now killing ');
		expect(result.newKC).toBeGreaterThan(0);
	});

	it('should get kodai buff', async () => {
		const user = await client.mockUser({
			slayerLevel: 99,
			bank: new Bank().add('Blood rune', 1000).add('Death rune', 1000).add('Water rune', 10000000),
			mageLevel: 99,
			mageGear: resolveItems(['Kodai wand'])
		});
		await user.giveSlayerTask(EMonster.ABYSSAL_DEMON);
		expect(user.gear.mage.weapon?.item).toEqual(itemID('Kodai wand'));
		await user.setAttackStyle([SkillsEnum.Magic]);
		const result = await user.kill(EMonster.ABYSSAL_DEMON, { method: 'barrage' });
		expect(result.xpGained.magic).toBeGreaterThan(0);
		expect(user.bank.amount('Blood rune')).toBeLessThan(1000);
		expect(user.bank.amount('Death rune')).toBeLessThan(1000);
		expect(result.newKC).toBeGreaterThan(0);
	});

	it('should get kodai buff even if forced to switch to mage', async () => {
		const user = await client.mockUser({
			slayerLevel: 99,
			bank: new Bank().add('Blood rune', 1000).add('Death rune', 1000).add('Water rune', 10000000),
			mageLevel: 99,
			mageGear: resolveItems(['Kodai wand'])
		});
		await user.giveSlayerTask(EMonster.ABYSSAL_DEMON);
		expect(user.gear.mage.weapon?.item).toEqual(itemID('Kodai wand'));
		await user.setAttackStyle([SkillsEnum.Attack]);
		const result = await user.kill(EMonster.ABYSSAL_DEMON, { method: 'barrage' });
		expect(result.xpGained.magic).toBeGreaterThan(0);
		expect(user.bank.amount('Blood rune')).toBeLessThan(1000);
		expect(user.bank.amount('Death rune')).toBeLessThan(1000);
		expect(result.commandResult).toContain('% boost for Kodai wand');
		expect(result.commandResult).toContain('% for Ice Barrage');
		expect(result.newKC).toBeGreaterThan(0);
	});

	it('should use cannon', async () => {
		const user = await client.mockUser({
			bank: new Bank().add('Cannonball', 100_000).add(CombatCannonItemBank),
			rangeLevel: 99,
			QP: 300,
			maxed: true
		});
		await user.giveSlayerTask(EMonster.MANIACAL_MONKEY);
		await user.setAttackStyle([SkillsEnum.Ranged]);
		const result = await user.kill(EMonster.MANIACAL_MONKEY, { method: 'cannon' });
		expect(result.xpGained.ranged).toBeGreaterThan(0);
		expect(user.bank.amount('Cannonball')).toBeLessThan(100_000);
		expect(result.newKC).toBeGreaterThan(0);
	});

	it('should use chins', async () => {
		const user = await client.mockUser({
			bank: new Bank().add('Red chinchompa', 5000),
			rangeLevel: 99,
			QP: 300,
			maxed: true
		});
		await user.giveSlayerTask(EMonster.MANIACAL_MONKEY);
		await user.setAttackStyle([SkillsEnum.Ranged]);
		const result = await user.kill(EMonster.MANIACAL_MONKEY, { method: 'chinning' });
		expect(result.commandResult).toContain('% for Red chinchomp');
		expect(user.bank.amount('Red chinchompa')).toBeLessThan(5000);
	});

	it('should kill vlad', async () => {
		const user = await client.mockUser({
			bank: new Bank().add('Red chinchompa', 5000),
			rangeLevel: 99,
			QP: 300,
			maxed: true
		});
		const startingBank = new Bank().add('Shark', 1_000_000).add('Vial of blood', 1000).add('Silver stake', 1000);
		await user.addItemsToBank({ items: startingBank });

		const gear = new Gear();
		gear.equip('Abyssal cape');
		gear.equip('Demonic piercer');
		gear.equip('Armadyl crossbow');
		gear.equip('Armadyl platebody');
		gear.equip("Inquisitor's plateskirt");
		gear.equip('Ranger boots');
		gear.equip("Inquisitor's hauberk");
		gear.equip('Dwarven blessing');
		gear.equip('Amulet of torture');
		gear.equip('Silver bolts', 10_000);

		await user.max();
		await user.update({
			gear_range: gear.raw() as any,
			skills_hitpoints: 200_000_000
		});

		const res = await user.kill(BSOMonsters.VladimirDrakan.id);
		expect(res.commandResult).toContain('now killing');
		await user.sync();

		const quantityKilled = res.activityResult!.q;
		expect(user.bank.amount('Shark')).toBeLessThan(1_000_000);
		expect(user.bank.amount('Vial of blood')).toEqual(1000 - quantityKilled);
		expect(user.bank.amount('Silver stake')).toEqual(1000 - quantityKilled);
		expect(user.gear.range.ammo!.quantity).toBeLessThan(10_000);
	});

	it('should use portable tanner', async () => {
		const user = await client.mockUser({
			bank: new Bank().add('Portable tanner', 1).add('Anti-dragon shield'),
			rangeLevel: 99,
			QP: 300,
			maxed: true
		});
		await user.max();
		const previousMats = user.materialsOwned().clone();
		await user.kill(EMonster.GREEN_DRAGON);
		const newMats = user.materialsOwned().clone();
		const leatherGained = user.bank.amount('Green dragon leather');
		expect(user.bank.amount('Green dragonhide')).toBe(0);
		expect(leatherGained).toBeGreaterThan(0);
		expect(newMats.amount('metallic')).toBeLessThan(previousMats.amount('metallic'));
		expect(newMats.amount('plated')).toBeLessThan(previousMats.amount('plated'));
		expect(newMats.amount('organic')).toBeLessThan(previousMats.amount('organic'));
		const userTannerStats = new Bank(
			(await user.fetchStats({ portable_tanner_bank: true })).portable_tanner_bank as ItemBank
		);
		expect(userTannerStats.amount('Green dragon leather')).toEqual(leatherGained);
		await client.sync();
		const clientPortableTannerLoot = new Bank(client.data.portable_tanner_loot as ItemBank);
		expect(clientPortableTannerLoot.amount('Green dragon leather')).toEqual(leatherGained);
		expect(clientPortableTannerLoot.length).toBe(1);
	});

	it('should use dwarven blessing', async () => {
		const user = await client.mockUser({
			bank: new Bank().add('Prayer potion(4)', 100),
			rangeLevel: 99,
			QP: 300,
			maxed: true,
			meleeGear: resolveItems(['Dwarven blessing'])
		});
		const result = await user.kill(EMonster.MAN);
		const duration = result.activityResult!.duration;
		const potsUsed = Math.ceil(duration / (Time.Minute * 5));
		expect(user.bank.amount('Prayer potion(4)')).toEqual(100 - potsUsed);
		expect(result.commandResult).toContain('20% for Dwarven blessing');
	});

	it('should use ori', async () => {
		const user = await client.mockUser({
			bank: new Bank().add('Prayer potion(4)', 100),
			QP: 300,
			maxed: true
		});
		await user.update({
			minion_equippedPet: itemID('Ori')
		});
		const result = await user.kill(EMonster.MAN, { quantity: 10 });
		expect(result.newKC).toBeGreaterThan(10);
	});

	it('should use ori', async () => {
		const user = await client.mockUser({
			bank: new Bank().add('Prayer potion(4)', 100),
			QP: 300,
			maxed: true
		});
		await user.update({
			minion_equippedPet: itemID('Ori')
		});
		const result = await user.kill(EMonster.MAN, { quantity: 1000 });
		expect(result.newKC).toBeGreaterThan(1000);
	});
});
