const { test, describe } = require('node:test');
const assert = require('node:assert');
const { registerTestUser, authFetch, BASE_URL } = require('./helpers');

describe('Bamboo Rewards & Shop System', () => {
  // ─── 1. Bamboo Wallet & Initialization ─────────────────────────────────────────

  test('1. New user wallet starts with 100 Bamboo coins and default_bamboo inventory', async () => {
    const user = await registerTestUser();

    // Check Balance
    const balanceRes = await authFetch('/rewards/balance', { method: 'GET' }, user.accessToken);
    assert.strictEqual(balanceRes.status, 200);
    const balanceData = await balanceRes.json();
    assert.strictEqual(balanceData.balance, 100);
    assert.strictEqual(balanceData.total_earned, 100);
    assert.strictEqual(balanceData.total_spent, 0);

    // Check Inventory
    const invRes = await authFetch('/shop/inventory', { method: 'GET' }, user.accessToken);
    assert.strictEqual(invRes.status, 200);
    const invData = await invRes.json();
    assert.ok(Array.isArray(invData.inventory));
    assert.ok(invData.inventory.includes('default_bamboo'));
  });

  test('2. Wallets are completely user-isolated', async () => {
    const userA = await registerTestUser();
    const userB = await registerTestUser();

    const resA = await authFetch('/rewards/balance', { method: 'GET' }, userA.accessToken);
    const resB = await authFetch('/rewards/balance', { method: 'GET' }, userB.accessToken);

    const dataA = await resA.json();
    const dataB = await resB.json();

    assert.strictEqual(dataA.balance, 100);
    assert.strictEqual(dataB.balance, 100);
  });

  // ─── 2. Habit Completion Rewards & 100% Daily Bonus ───────────────────────────

  test('3. Habit completion awards +10 Bamboo and updates balance to 110', async () => {
    const user = await registerTestUser();

    // Create a daily habit
    const createRes = await authFetch(
      '/habits',
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'Morning Hydration',
          frequency_type: 'daily',
        }),
      },
      user.accessToken
    );
    assert.strictEqual(createRes.status, 201);
    const { habit } = await createRes.json();

    // Complete habit (single habit planned, so it will complete all habits = 10 + 15 = 25)
    // To test ONLY single habit without 100% bonus, create 2 habits first
    const createRes2 = await authFetch(
      '/habits',
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'Evening Stretch',
          frequency_type: 'daily',
        }),
      },
      user.accessToken
    );
    assert.strictEqual(createRes2.status, 201);

    // Complete only habit 1 of 2
    const compRes = await authFetch(
      `/habits/${habit.id}/completions`,
      {
        method: 'POST',
        body: JSON.stringify({ completion_date: '2026-09-28' }),
      },
      user.accessToken
    );
    assert.strictEqual(compRes.status, 201);
    const compData = await compRes.json();

    assert.strictEqual(compData.bamboo_earned, 10);
    assert.strictEqual(compData.current_bamboo_balance, 110);
  });

  test('4. Repeating the same completion does not award another +10', async () => {
    const user = await registerTestUser();

    const createRes1 = await authFetch(
      '/habits',
      { method: 'POST', body: JSON.stringify({ name: 'Habit 1', frequency_type: 'daily' }) },
      user.accessToken
    );
    const createRes2 = await authFetch(
      '/habits',
      { method: 'POST', body: JSON.stringify({ name: 'Habit 2', frequency_type: 'daily' }) },
      user.accessToken
    );
    const { habit: h1 } = await createRes1.json();

    // First completion
    const comp1 = await authFetch(
      `/habits/${h1.id}/completions`,
      { method: 'POST', body: JSON.stringify({ completion_date: '2026-09-28' }) },
      user.accessToken
    );
    const data1 = await comp1.json();
    assert.strictEqual(data1.bamboo_earned, 10);
    assert.strictEqual(data1.current_bamboo_balance, 110);

    // Repeat same completion
    const comp2 = await authFetch(
      `/habits/${h1.id}/completions`,
      { method: 'POST', body: JSON.stringify({ completion_date: '2026-09-28' }) },
      user.accessToken
    );
    const data2 = await comp2.json();
    assert.strictEqual(data2.bamboo_earned, 0);
    assert.strictEqual(data2.current_bamboo_balance, 110);
  });

  test('5. Completing all scheduled habits for the day awards +15 daily perfection bonus (total +25)', async () => {
    const user = await registerTestUser();

    // Create 1 daily habit
    const createRes = await authFetch(
      '/habits',
      { method: 'POST', body: JSON.stringify({ name: 'Single Habit', frequency_type: 'daily' }) },
      user.accessToken
    );
    const { habit } = await createRes.json();

    // Complete it (1 of 1 completed = 10 habit + 15 daily bonus = 25)
    const compRes = await authFetch(
      `/habits/${habit.id}/completions`,
      { method: 'POST', body: JSON.stringify({ completion_date: '2026-09-28' }) },
      user.accessToken
    );
    assert.strictEqual(compRes.status, 201);
    const data = await compRes.json();
    assert.strictEqual(data.bamboo_earned, 25);
    assert.strictEqual(data.current_bamboo_balance, 125);
  });

  test('6. Daily +15 bonus cannot be duplicated', async () => {
    const user = await registerTestUser();

    const createRes = await authFetch(
      '/habits',
      { method: 'POST', body: JSON.stringify({ name: 'Solo Habit', frequency_type: 'daily' }) },
      user.accessToken
    );
    const { habit } = await createRes.json();

    // Complete once
    await authFetch(
      `/habits/${habit.id}/completions`,
      { method: 'POST', body: JSON.stringify({ completion_date: '2026-09-28' }) },
      user.accessToken
    );

    // Repeat call
    const repeatRes = await authFetch(
      `/habits/${habit.id}/completions`,
      { method: 'POST', body: JSON.stringify({ completion_date: '2026-09-28' }) },
      user.accessToken
    );
    const repeatData = await repeatRes.json();
    assert.strictEqual(repeatData.bamboo_earned, 0);
    assert.strictEqual(repeatData.current_bamboo_balance, 125);
  });

  // ─── 3. Daily Gift ────────────────────────────────────────────────────────────

  test('7. Daily gift claims +35 Bamboo', async () => {
    const user = await registerTestUser();

    const giftRes = await authFetch('/rewards/daily-gift', { method: 'POST' }, user.accessToken);
    assert.strictEqual(giftRes.status, 200);
    const giftData = await giftRes.json();
    assert.strictEqual(giftData.claimed, true);
    assert.strictEqual(giftData.bamboo_earned, 35);
    assert.strictEqual(giftData.current_bamboo_balance, 135);
  });

  test('8. Daily gift cannot be claimed twice on same calendar day', async () => {
    const user = await registerTestUser();

    // Claim 1
    const res1 = await authFetch('/rewards/daily-gift', { method: 'POST' }, user.accessToken);
    const data1 = await res1.json();
    assert.strictEqual(data1.claimed, true);
    assert.strictEqual(data1.current_bamboo_balance, 135);

    // Claim 2
    const res2 = await authFetch('/rewards/daily-gift', { method: 'POST' }, user.accessToken);
    const data2 = await res2.json();
    assert.strictEqual(data2.claimed, false);
    assert.strictEqual(data2.bamboo_earned, 0);
    assert.strictEqual(data2.current_bamboo_balance, 135);
  });

  test('9. Transaction ledger records credits and paginates properly', async () => {
    const user = await registerTestUser();

    // Claim daily gift (+35)
    await authFetch('/rewards/daily-gift', { method: 'POST' }, user.accessToken);

    const txRes = await authFetch('/rewards/transactions?limit=10', { method: 'GET' }, user.accessToken);
    assert.strictEqual(txRes.status, 200);
    const txData = await txRes.json();

    assert.ok(Array.isArray(txData.transactions));
    assert.ok(txData.total >= 2); // Initial bonus + daily gift
    const types = txData.transactions.map((t) => t.type);
    assert.ok(types.includes('DAILY_GIFT'));
  });

  // ─── 4. Shop Catalog & Pricing ────────────────────────────────────────────────

  test('10. Catalog returns seeded active items with exact prices and categories', async () => {
    const user = await registerTestUser();

    const itemsRes = await authFetch('/shop/items', { method: 'GET' }, user.accessToken);
    assert.strictEqual(itemsRes.status, 200);
    const { items } = await itemsRes.json();

    assert.ok(Array.isArray(items));
    assert.ok(items.length >= 14);

    const detective = items.find((i) => i.id === 'detective');
    assert.ok(detective);
    assert.strictEqual(detective.price, 60);
    assert.strictEqual(detective.category, 'hat');

    const aviators = items.find((i) => i.id === 'aviators');
    assert.ok(aviators);
    assert.strictEqual(aviators.price, 75);
    assert.strictEqual(aviators.category, 'glasses');

    const crown = items.find((i) => i.id === 'crown');
    assert.ok(crown);
    assert.strictEqual(crown.price, 250);
    assert.strictEqual(crown.rarity, 'legendary');
  });

  // ─── 5. Purchasing Items ──────────────────────────────────────────────────────

  test('11. User can purchase an accessory with sufficient balance (price = 60)', async () => {
    const user = await registerTestUser();

    const buyRes = await authFetch(
      '/shop/purchase',
      {
        method: 'POST',
        body: JSON.stringify({ itemId: 'detective' }),
      },
      user.accessToken
    );

    assert.strictEqual(buyRes.status, 200);
    const buyData = await buyRes.json();

    assert.strictEqual(buyData.purchase.itemId, 'detective');
    assert.strictEqual(buyData.purchase.price, 60);
    assert.strictEqual(buyData.current_bamboo_balance, 40); // 100 - 60 = 40
    assert.ok(buyData.inventory.includes('detective'));
  });

  test('12. Frontend-supplied price is completely ignored by server', async () => {
    const user = await registerTestUser();

    const buyRes = await authFetch(
      '/shop/purchase',
      {
        method: 'POST',
        body: JSON.stringify({ itemId: 'chef', price: 0 }), // Attempt cheat
      },
      user.accessToken
    );

    assert.strictEqual(buyRes.status, 200);
    const buyData = await buyRes.json();
    assert.strictEqual(buyData.purchase.price, 50); // Server-enforced price
    assert.strictEqual(buyData.current_bamboo_balance, 50); // 100 - 50 = 50
  });

  test('13. Insufficient balance purchase is rejected with 400', async () => {
    const user = await registerTestUser(); // Starts with 100

    // Crown costs 250
    const buyRes = await authFetch(
      '/shop/purchase',
      {
        method: 'POST',
        body: JSON.stringify({ itemId: 'crown' }),
      },
      user.accessToken
    );

    assert.strictEqual(buyRes.status, 400);
    const errData = await buyRes.json();
    assert.ok(errData.error.toLowerCase().includes('insufficient'));

    // Balance remains 100
    const balanceRes = await authFetch('/rewards/balance', { method: 'GET' }, user.accessToken);
    const { balance } = await balanceRes.json();
    assert.strictEqual(balance, 100);
  });

  test('14. Duplicate purchase of already-owned item is rejected with 409', async () => {
    const user = await registerTestUser();

    // Purchase detective cap (60)
    await authFetch('/shop/purchase', { method: 'POST', body: JSON.stringify({ itemId: 'detective' }) }, user.accessToken);

    // Attempt duplicate purchase
    const dupRes = await authFetch('/shop/purchase', { method: 'POST', body: JSON.stringify({ itemId: 'detective' }) }, user.accessToken);
    assert.strictEqual(dupRes.status, 409);
    const dupData = await dupRes.json();
    assert.ok(dupData.error.toLowerCase().includes('already owned'));
  });

  test('15. Purchase records a negative Bamboo transaction in ledger', async () => {
    const user = await registerTestUser();

    await authFetch('/shop/purchase', { method: 'POST', body: JSON.stringify({ itemId: 'party_hat' }) }, user.accessToken); // 40 coins

    const txRes = await authFetch('/rewards/transactions', { method: 'GET' }, user.accessToken);
    const { transactions } = await txRes.json();

    const purchaseTx = transactions.find((t) => t.type === 'SHOP_PURCHASE');
    assert.ok(purchaseTx);
    assert.strictEqual(purchaseTx.amount, -40);
    assert.strictEqual(purchaseTx.balance_after, 60);
  });

  // ─── 6. Equipping & Wardrobe ──────────────────────────────────────────────────

  test('16. User can equip and unequip owned hat and glasses', async () => {
    const user = await registerTestUser();

    // Buy detective cap (hat, 60)
    await authFetch('/shop/purchase', { method: 'POST', body: JSON.stringify({ itemId: 'detective' }) }, user.accessToken);

    // Equip detective hat
    const equipHatRes = await authFetch(
      '/shop/equip',
      {
        method: 'POST',
        body: JSON.stringify({ category: 'hat', itemId: 'detective' }),
      },
      user.accessToken
    );
    assert.strictEqual(equipHatRes.status, 200);
    const hatData = await equipHatRes.json();
    assert.strictEqual(hatData.outfit.equipped_hat, 'detective');

    // Check inventory endpoint returns equipped state
    const invRes = await authFetch('/shop/inventory', { method: 'GET' }, user.accessToken);
    const invData = await invRes.json();
    assert.strictEqual(invData.outfit.equipped_hat, 'detective');

    // Unequip hat
    const unequipRes = await authFetch(
      '/shop/equip',
      {
        method: 'POST',
        body: JSON.stringify({ category: 'hat', itemId: null }),
      },
      user.accessToken
    );
    assert.strictEqual(unequipRes.status, 200);
    const unequipData = await unequipRes.json();
    assert.strictEqual(unequipData.outfit.equipped_hat, null);
  });

  test('17. User cannot equip unowned item (rejected with 403)', async () => {
    const user = await registerTestUser();

    const equipRes = await authFetch(
      '/shop/equip',
      {
        method: 'POST',
        body: JSON.stringify({ category: 'hat', itemId: 'crown' }),
      },
      user.accessToken
    );

    assert.strictEqual(equipRes.status, 403);
  });

  test('18. User cannot equip a hat as glasses (rejected with 400)', async () => {
    const user = await registerTestUser();

    await authFetch('/shop/purchase', { method: 'POST', body: JSON.stringify({ itemId: 'detective' }) }, user.accessToken);

    const equipRes = await authFetch(
      '/shop/equip',
      {
        method: 'POST',
        body: JSON.stringify({ category: 'glasses', itemId: 'detective' }),
      },
      user.accessToken
    );

    assert.strictEqual(equipRes.status, 400);
  });

  // ─── 7. Concurrency & Isolation ───────────────────────────────────────────────

  test('19. Concurrent purchases cannot overspend wallet below zero', async () => {
    const user = await registerTestUser(); // Starts with 100 Bamboo

    // Attempt to buy Detective Cap (60) and Aviator Shades (75) simultaneously (total 135 > 100)
    const [res1, res2] = await Promise.all([
      authFetch('/shop/purchase', { method: 'POST', body: JSON.stringify({ itemId: 'detective' }) }, user.accessToken),
      authFetch('/shop/purchase', { method: 'POST', body: JSON.stringify({ itemId: 'aviators' }) }, user.accessToken),
    ]);

    const statuses = [res1.status, res2.status].sort();
    // Exactly one should succeed (200) and one must fail with insufficient funds (400)
    assert.deepStrictEqual(statuses, [200, 400]);

    const balanceRes = await authFetch('/rewards/balance', { method: 'GET' }, user.accessToken);
    const { balance } = await balanceRes.json();
    assert.ok(balance >= 0);
    assert.ok(balance === 40 || balance === 25);
  });

  test('20. User cannot access or equip another user\'s inventory', async () => {
    const userA = await registerTestUser();
    const userB = await registerTestUser();

    // User A buys detective cap
    await authFetch('/shop/purchase', { method: 'POST', body: JSON.stringify({ itemId: 'detective' }) }, userA.accessToken);

    // User B tries to equip detective cap
    const equipRes = await authFetch(
      '/shop/equip',
      { method: 'POST', body: JSON.stringify({ category: 'hat', itemId: 'detective' }) },
      userB.accessToken
    );
    assert.strictEqual(equipRes.status, 403);

    // User B inventory should NOT contain detective cap
    const invB = await authFetch('/shop/inventory', { method: 'GET' }, userB.accessToken);
    const invBData = await invB.json();
    assert.strictEqual(invBData.inventory.includes('detective'), false);
  });
});
