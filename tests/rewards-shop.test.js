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

  // ─── 8. Reward Reversals & Uncompletion Flow ─────────────────────────────────

  test('21. Complete habit -> uncomplete habit reverses +10 reward and returns correct bamboo balance', async () => {
    const user = await registerTestUser(); // balance: 100

    // Create 2 daily habits (so 1 completion is not 100% day bonus)
    const h1Res = await authFetch('/habits', { method: 'POST', body: JSON.stringify({ name: 'H1', frequency_type: 'daily' }) }, user.accessToken);
    await authFetch('/habits', { method: 'POST', body: JSON.stringify({ name: 'H2', frequency_type: 'daily' }) }, user.accessToken);
    const { habit: h1 } = await h1Res.json();

    // 1. Complete H1 (100 -> 110)
    const compRes = await authFetch(`/habits/${h1.id}/completions`, { method: 'POST', body: JSON.stringify({ completion_date: '2026-09-29' }) }, user.accessToken);
    const compData = await compRes.json();
    assert.strictEqual(compData.bamboo_earned, 10);
    assert.strictEqual(compData.current_bamboo_balance, 110);

    // 2. Uncomplete H1 (110 -> 100)
    const undoRes = await authFetch(`/habits/${h1.id}/completions/2026-09-29`, { method: 'DELETE' }, user.accessToken);
    assert.strictEqual(undoRes.status, 200);
    const undoData = await undoRes.json();
    assert.strictEqual(undoData.message, 'Completion removed.');
    assert.strictEqual(undoData.bamboo_deducted, 10);
    assert.strictEqual(undoData.current_bamboo_balance, 100);

    // 3. Confirm balance via /rewards/balance endpoint
    const balRes = await authFetch('/rewards/balance', { method: 'GET' }, user.accessToken);
    const balData = await balRes.json();
    assert.strictEqual(balData.balance, 100);
  });

  test('22. Complete -> uncomplete -> re-complete awards +10 again (clears idempotency lock)', async () => {
    const user = await registerTestUser(); // balance: 100

    const h1Res = await authFetch('/habits', { method: 'POST', body: JSON.stringify({ name: 'H1', frequency_type: 'daily' }) }, user.accessToken);
    await authFetch('/habits', { method: 'POST', body: JSON.stringify({ name: 'H2', frequency_type: 'daily' }) }, user.accessToken);
    const { habit: h1 } = await h1Res.json();

    // Step 1: First complete (100 -> 110)
    await authFetch(`/habits/${h1.id}/completions`, { method: 'POST', body: JSON.stringify({ completion_date: '2026-09-29' }) }, user.accessToken);

    // Step 2: Uncomplete (110 -> 100)
    await authFetch(`/habits/${h1.id}/completions/2026-09-29`, { method: 'DELETE' }, user.accessToken);

    // Step 3: Re-complete same habit on same date (100 -> 110)
    const reCompRes = await authFetch(`/habits/${h1.id}/completions`, { method: 'POST', body: JSON.stringify({ completion_date: '2026-09-29' }) }, user.accessToken);
    assert.strictEqual(reCompRes.status, 201);
    const reCompData = await reCompRes.json();
    assert.strictEqual(reCompData.bamboo_earned, 10);
    assert.strictEqual(reCompData.current_bamboo_balance, 110);
  });

  test('23. Repeated uncomplete call is safely handled and does not double-deduct', async () => {
    const user = await registerTestUser();

    const h1Res = await authFetch('/habits', { method: 'POST', body: JSON.stringify({ name: 'Solo', frequency_type: 'daily' }) }, user.accessToken);
    const { habit: h1 } = await h1Res.json();

    // Complete
    await authFetch(`/habits/${h1.id}/completions`, { method: 'POST', body: JSON.stringify({ completion_date: '2026-09-29' }) }, user.accessToken);

    // Uncomplete once
    const del1 = await authFetch(`/habits/${h1.id}/completions/2026-09-29`, { method: 'DELETE' }, user.accessToken);
    assert.strictEqual(del1.status, 200);

    // Uncomplete again -> completion does not exist -> 404
    const del2 = await authFetch(`/habits/${h1.id}/completions/2026-09-29`, { method: 'DELETE' }, user.accessToken);
    assert.strictEqual(del2.status, 404);

    // Balance remains exactly 100
    const balRes = await authFetch('/rewards/balance', { method: 'GET' }, user.accessToken);
    const balData = await balRes.json();
    assert.strictEqual(balData.balance, 100);
  });

  test('24. 100% day perfection bonus (+15) is revoked when one habit is uncompleted, and re-awarded on re-complete', async () => {
    const user = await registerTestUser(); // balance: 100

    const h1Res = await authFetch('/habits', { method: 'POST', body: JSON.stringify({ name: 'H1', frequency_type: 'daily' }) }, user.accessToken);
    const h2Res = await authFetch('/habits', { method: 'POST', body: JSON.stringify({ name: 'H2', frequency_type: 'daily' }) }, user.accessToken);
    const { habit: h1 } = await h1Res.json();
    const { habit: h2 } = await h2Res.json();

    // Complete H1 (+10) -> balance 110
    await authFetch(`/habits/${h1.id}/completions`, { method: 'POST', body: JSON.stringify({ completion_date: '2026-09-29' }) }, user.accessToken);

    // Complete H2 (+10 habit + 15 perfection bonus = +25) -> balance 135
    const comp2Res = await authFetch(`/habits/${h2.id}/completions`, { method: 'POST', body: JSON.stringify({ completion_date: '2026-09-29' }) }, user.accessToken);
    const comp2Data = await comp2Res.json();
    assert.strictEqual(comp2Data.bamboo_earned, 25);
    assert.strictEqual(comp2Data.current_bamboo_balance, 135);

    // Uncomplete H2 -> should revoke +10 (H2) and +15 (daily bonus) -> balance returns to 110
    const undoRes = await authFetch(`/habits/${h2.id}/completions/2026-09-29`, { method: 'DELETE' }, user.accessToken);
    assert.strictEqual(undoRes.status, 200);
    const undoData = await undoRes.json();
    assert.strictEqual(undoData.bamboo_deducted, 25);
    assert.strictEqual(undoData.current_bamboo_balance, 110);

    // Re-complete H2 -> day is 100% complete again -> awards +10 + 15 = 25 -> balance 135
    const reCompRes = await authFetch(`/habits/${h2.id}/completions`, { method: 'POST', body: JSON.stringify({ completion_date: '2026-09-29' }) }, user.accessToken);
    const reCompData = await reCompRes.json();
    assert.strictEqual(reCompData.bamboo_earned, 25);
    assert.strictEqual(reCompData.current_bamboo_balance, 135);
  });

  test('25. Uncompleting habit never affects DAILY_GIFT, INITIAL_BONUS, or SHOP_PURCHASE', async () => {
    const user = await registerTestUser(); // 100 initial bonus

    // Claim daily gift (+35) -> balance 135
    await authFetch('/rewards/daily-gift', { method: 'POST' }, user.accessToken);

    // Buy Party Cone (-40) -> balance 95
    await authFetch('/shop/purchase', { method: 'POST', body: JSON.stringify({ itemId: 'party_hat' }) }, user.accessToken);

    // Create 2 habits and complete H1 (+10) -> balance 105
    const h1Res = await authFetch('/habits', { method: 'POST', body: JSON.stringify({ name: 'H1', frequency_type: 'daily' }) }, user.accessToken);
    await authFetch('/habits', { method: 'POST', body: JSON.stringify({ name: 'H2', frequency_type: 'daily' }) }, user.accessToken);
    const { habit: h1 } = await h1Res.json();

    await authFetch(`/habits/${h1.id}/completions`, { method: 'POST', body: JSON.stringify({ completion_date: '2026-09-29' }) }, user.accessToken);

    // Uncomplete H1 (-10) -> balance returns to 95
    const undoRes = await authFetch(`/habits/${h1.id}/completions/2026-09-29`, { method: 'DELETE' }, user.accessToken);
    const undoData = await undoRes.json();
    assert.strictEqual(undoData.bamboo_deducted, 10);
    assert.strictEqual(undoData.current_bamboo_balance, 95);

    // Verify inventory still has party_hat and default_bamboo
    const invRes = await authFetch('/shop/inventory', { method: 'GET' }, user.accessToken);
    const { inventory } = await invRes.json();
    assert.ok(inventory.includes('party_hat'));
    assert.ok(inventory.includes('default_bamboo'));
  });

  test('26. Uncompleting Habit 1 does not affect Habit 2 completion reward or status', async () => {
    const user = await registerTestUser(); // balance 100

    // Create 3 daily habits (so completing 2 is not 100% bonus)
    const h1Res = await authFetch('/habits', { method: 'POST', body: JSON.stringify({ name: 'H1', frequency_type: 'daily' }) }, user.accessToken);
    const h2Res = await authFetch('/habits', { method: 'POST', body: JSON.stringify({ name: 'H2', frequency_type: 'daily' }) }, user.accessToken);
    await authFetch('/habits', { method: 'POST', body: JSON.stringify({ name: 'H3', frequency_type: 'daily' }) }, user.accessToken);
    const { habit: h1 } = await h1Res.json();
    const { habit: h2 } = await h2Res.json();

    // Complete H1 (+10)
    const c1Res = await authFetch(`/habits/${h1.id}/completions`, { method: 'POST' }, user.accessToken);
    const c1Data = await c1Res.json();
    const dateStr = c1Data.completion.completion_date;

    // Complete H2 (+10)
    await authFetch(`/habits/${h2.id}/completions`, { method: 'POST' }, user.accessToken);

    // Total balance: 100 + 10 + 10 = 120
    const b1 = await authFetch('/rewards/balance', { method: 'GET' }, user.accessToken);
    assert.strictEqual((await b1.json()).balance, 120);

    // Uncomplete H1 -> should only deduct 10, balance = 110
    const undoRes = await authFetch(`/habits/${h1.id}/completions/${dateStr}`, { method: 'DELETE' }, user.accessToken);
    const undoData = await undoRes.json();
    assert.strictEqual(undoData.bamboo_deducted, 10);
    assert.strictEqual(undoData.current_bamboo_balance, 110);

    // H2 completion is still intact in DB
    const compRes = await authFetch(`/habits/${h2.id}/completions`, { method: 'GET' }, user.accessToken);
    const compData = await compRes.json();
    assert.strictEqual(compData.completions.length, 1);
    assert.strictEqual(compData.completions[0].completion_date, dateStr);
  });

  // ─── 9. Date Normalization & Reward Revocation ISO Formats ───────────────────

  test('27. Case 1: Uncompleting with ISO timestamp (2026-09-29T00:00:00.000Z) revokes +10 reward and restores balance', async () => {
    const user = await registerTestUser(); // balance: 100

    const h1Res = await authFetch('/habits', { method: 'POST', body: JSON.stringify({ name: 'Meditation', frequency_type: 'daily' }) }, user.accessToken);
    await authFetch('/habits', { method: 'POST', body: JSON.stringify({ name: 'Read Book', frequency_type: 'daily' }) }, user.accessToken);
    const { habit: h1 } = await h1Res.json();

    // 1. Complete habit for 2026-09-29 (100 -> 110)
    const compRes = await authFetch(`/habits/${h1.id}/completions`, { method: 'POST', body: JSON.stringify({ completion_date: '2026-09-29' }) }, user.accessToken);
    const compData = await compRes.json();
    assert.strictEqual(compData.bamboo_earned, 10);
    assert.strictEqual(compData.current_bamboo_balance, 110);

    // 2. Uncomplete using ISO 8601 timestamp with encoded URI
    const isoDateStr = encodeURIComponent('2026-09-29T00:00:00.000Z');
    const undoRes = await authFetch(`/habits/${h1.id}/completions/${isoDateStr}`, { method: 'DELETE' }, user.accessToken);
    assert.strictEqual(undoRes.status, 200);
    const undoData = await undoRes.json();
    assert.strictEqual(undoData.message, 'Completion removed.');
    assert.strictEqual(undoData.bamboo_deducted, 10);
    assert.strictEqual(undoData.current_bamboo_balance, 100);

    // 3. Confirm balance via /rewards/balance
    const balRes = await authFetch('/rewards/balance', { method: 'GET' }, user.accessToken);
    const balData = await balRes.json();
    assert.strictEqual(balData.balance, 100);

    // 4. Confirm transaction ledger has 0 orphan HABIT_COMPLETION records
    const txRes = await authFetch('/rewards/transactions', { method: 'GET' }, user.accessToken);
    const txData = await txRes.json();
    const completionTxs = txData.transactions.filter(t => t.type === 'HABIT_COMPLETION');
    assert.strictEqual(completionTxs.length, 0);
  });

  test('28. Case 2: Uncompleting with canonical YYYY-MM-DD (2026-09-29) revokes +10 reward and restores balance', async () => {
    const user = await registerTestUser(); // balance: 100

    const h1Res = await authFetch('/habits', { method: 'POST', body: JSON.stringify({ name: 'Yoga', frequency_type: 'daily' }) }, user.accessToken);
    await authFetch('/habits', { method: 'POST', body: JSON.stringify({ name: 'Stretch', frequency_type: 'daily' }) }, user.accessToken);
    const { habit: h1 } = await h1Res.json();

    // 1. Complete habit for 2026-09-29 (100 -> 110)
    const compRes = await authFetch(`/habits/${h1.id}/completions`, { method: 'POST', body: JSON.stringify({ completion_date: '2026-09-29' }) }, user.accessToken);
    const compData = await compRes.json();
    assert.strictEqual(compData.bamboo_earned, 10);
    assert.strictEqual(compData.current_bamboo_balance, 110);

    // 2. Uncomplete using canonical YYYY-MM-DD
    const undoRes = await authFetch(`/habits/${h1.id}/completions/2026-09-29`, { method: 'DELETE' }, user.accessToken);
    assert.strictEqual(undoRes.status, 200);
    const undoData = await undoRes.json();
    assert.strictEqual(undoData.message, 'Completion removed.');
    assert.strictEqual(undoData.bamboo_deducted, 10);
    assert.strictEqual(undoData.current_bamboo_balance, 100);

    // 3. Confirm balance
    const balRes = await authFetch('/rewards/balance', { method: 'GET' }, user.accessToken);
    assert.strictEqual((await balRes.json()).balance, 100);

    // 4. Confirm transaction ledger has 0 orphan HABIT_COMPLETION records
    const txRes = await authFetch('/rewards/transactions', { method: 'GET' }, user.accessToken);
    const txData = await txRes.json();
    const completionTxs = txData.transactions.filter(t => t.type === 'HABIT_COMPLETION');
    assert.strictEqual(completionTxs.length, 0);
  });

  test('29. Case 3: Repeated DELETE calls are idempotent and never double-deduct Bamboo', async () => {
    const user = await registerTestUser(); // balance: 100

    const h1Res = await authFetch('/habits', { method: 'POST', body: JSON.stringify({ name: 'Write Code', frequency_type: 'daily' }) }, user.accessToken);
    const { habit: h1 } = await h1Res.json();

    // Complete
    await authFetch(`/habits/${h1.id}/completions`, { method: 'POST', body: JSON.stringify({ completion_date: '2026-09-29' }) }, user.accessToken);

    // First DELETE -> 200 OK, revokes reward
    const del1 = await authFetch(`/habits/${h1.id}/completions/2026-09-29`, { method: 'DELETE' }, user.accessToken);
    assert.strictEqual(del1.status, 200);
    const del1Data = await del1.json();
    assert.strictEqual(del1Data.current_bamboo_balance, 100);

    // Second DELETE -> 404 Completion not found, balance remains 100
    const del2 = await authFetch(`/habits/${h1.id}/completions/2026-09-29`, { method: 'DELETE' }, user.accessToken);
    assert.strictEqual(del2.status, 404);

    // Third DELETE with ISO format -> 404 Completion not found
    const del3 = await authFetch(`/habits/${h1.id}/completions/${encodeURIComponent('2026-09-29T00:00:00.000Z')}`, { method: 'DELETE' }, user.accessToken);
    assert.strictEqual(del3.status, 404);

    // Verify balance is still exactly 100
    const balRes = await authFetch('/rewards/balance', { method: 'GET' }, user.accessToken);
    assert.strictEqual((await balRes.json()).balance, 100);
  });

  test('30. Case 4: Unrelated transaction protection (Daily Gift, Shop, Initial Bonus unaffected)', async () => {
    const user = await registerTestUser(); // 100 initial bonus

    // Claim daily gift (+35) -> balance 135
    await authFetch('/rewards/daily-gift', { method: 'POST' }, user.accessToken);

    // Buy Party Cone (-40) -> balance 95
    await authFetch('/shop/purchase', { method: 'POST', body: JSON.stringify({ itemId: 'party_hat' }) }, user.accessToken);

    // Create 3 habits
    const h1Res = await authFetch('/habits', { method: 'POST', body: JSON.stringify({ name: 'H1', frequency_type: 'daily' }) }, user.accessToken);
    const h2Res = await authFetch('/habits', { method: 'POST', body: JSON.stringify({ name: 'H2', frequency_type: 'daily' }) }, user.accessToken);
    await authFetch('/habits', { method: 'POST', body: JSON.stringify({ name: 'H3', frequency_type: 'daily' }) }, user.accessToken);
    const { habit: h1 } = await h1Res.json();
    const { habit: h2 } = await h2Res.json();

    // Complete H1 (+10) -> balance 105
    await authFetch(`/habits/${h1.id}/completions`, { method: 'POST', body: JSON.stringify({ completion_date: '2026-09-29' }) }, user.accessToken);

    // Complete H2 (+10) -> balance 115
    await authFetch(`/habits/${h2.id}/completions`, { method: 'POST', body: JSON.stringify({ completion_date: '2026-09-29' }) }, user.accessToken);

    // Verify pre-uncomplete balance is 115
    const preBal = await authFetch('/rewards/balance', { method: 'GET' }, user.accessToken);
    assert.strictEqual((await preBal.json()).balance, 115);

    // Uncomplete H1 using ISO timestamp -> should only revoke H1 (+10), balance becomes 105
    const undoRes = await authFetch(`/habits/${h1.id}/completions/${encodeURIComponent('2026-09-29T12:34:56.789Z')}`, { method: 'DELETE' }, user.accessToken);
    const undoData = await undoRes.json();
    assert.strictEqual(undoData.bamboo_deducted, 10);
    assert.strictEqual(undoData.current_bamboo_balance, 105);

    // Verify inventory still has items
    const invRes = await authFetch('/shop/inventory', { method: 'GET' }, user.accessToken);
    const { inventory } = await invRes.json();
    assert.ok(inventory.includes('party_hat'));
    assert.ok(inventory.includes('default_bamboo'));

    // Verify H2 completion is still present
    const h2Comps = await authFetch(`/habits/${h2.id}/completions`, { method: 'GET' }, user.accessToken);
    const h2CompsData = await h2Comps.json();
    assert.strictEqual(h2CompsData.completions.length, 1);
  });
});
