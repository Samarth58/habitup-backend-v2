const { registerTestUser, authFetch } = require('../tests/helpers');

async function runEndToEndTrace() {
  const ts = Date.now().toString().slice(-6);
  const usernameA = `test_alice_${ts}`;
  const usernameB = `test_bob_${ts}`;

  console.log('--- Step 1: User A and User B registration ---');
  const userA = await registerTestUser({ username: usernameA });
  const userB = await registerTestUser({ username: usernameB });

  console.log(`User A registered: id=${userA.user.id}, username=${userA.username}`);
  console.log(`User B registered: id=${userB.user.id}, username=${userB.username}`);

  // 1. Search for User B by username prefix
  console.log('\n--- Step 1: User A searches for User B by prefix ---');
  const searchPrefix = userB.username.slice(0, 10);
  const searchRes = await authFetch(`/users/search?query=${encodeURIComponent(searchPrefix)}`, {}, userA.accessToken);
  const searchBody = await searchRes.json();
  console.log(`GET /users/search?query=${searchPrefix} -> status:`, searchRes.status, searchBody);
  if (!searchBody.results || !searchBody.results.some(u => u.username === userB.username)) {
    throw new Error(`Search failed to find User B (${userB.username})`);
  }
  console.log('Found User B in search results.');

  // 2. Send Friend Request from User A to User B
  console.log('\n--- Step 2: User A sends friend request to User B ---');
  const sendRes = await authFetch('/friends/request', {
    method: 'POST',
    body: JSON.stringify({ username: userB.username }),
  }, userA.accessToken);
  const sendBody = await sendRes.json();
  console.log('POST /friends/request -> status:', sendRes.status, sendBody);
  if (sendRes.status !== 201 || !sendBody.request_id) {
    throw new Error('Send friend request failed');
  }
  const requestId = sendBody.request_id;
  console.log(`Friend request created with request_id=${requestId}`);

  // 3 & 4. User B checks pending requests
  console.log('\n--- Step 3 & 4: User B fetches pending requests ---');
  const pendingRes = await authFetch('/friends/requests', {}, userB.accessToken);
  const pendingBody = await pendingRes.json();
  console.log('GET /friends/requests -> status:', pendingRes.status, pendingBody);
  if (!pendingBody.pending_requests || pendingBody.pending_requests.length === 0) {
    throw new Error('User B has no pending requests returned!');
  }
  console.log('Pending requests list for User B:', pendingBody.pending_requests);
  const receivedRequest = pendingBody.pending_requests.find(r => r.request_id === requestId);
  if (!receivedRequest) {
    throw new Error('Request ID mismatch in pending requests');
  }
  console.log(`Found request from ${receivedRequest.from_username} with request_id=${receivedRequest.request_id}`);

  // 5. User B accepts the request
  console.log('\n--- Step 5: User B accepts the friend request ---');
  const acceptRes = await authFetch(`/friends/requests/${receivedRequest.request_id}/accept`, {
    method: 'POST',
  }, userB.accessToken);
  const acceptBody = await acceptRes.json();
  console.log(`POST /friends/requests/${receivedRequest.request_id}/accept -> status:`, acceptRes.status, acceptBody);
  if (acceptRes.status !== 200 || acceptBody.status !== 'accepted') {
    throw new Error('Accept friend request failed');
  }

  // 6. Verify friendship exists for both users
  console.log('\n--- Step 6: Verify friends list for both users ---');
  const [friendsARes, friendsBRes] = await Promise.all([
    authFetch('/friends', {}, userA.accessToken),
    authFetch('/friends', {}, userB.accessToken),
  ]);
  const friendsABody = await friendsARes.json();
  const friendsBBody = await friendsBRes.json();
  console.log('User A friends:', friendsABody);
  console.log('User B friends:', friendsBBody);

  if (!friendsABody.friends.some(f => f.username === userB.username) ||
      !friendsBBody.friends.some(f => f.username === userA.username)) {
    throw new Error('Friendship not reflected in friends list for both users');
  }

  console.log('\n=== ALL END-TO-END FLOW CHECKS PASSED SUCCESSFULLY ===');
}

runEndToEndTrace().catch(err => {
  console.error('Flow failed:', err);
  process.exit(1);
});
