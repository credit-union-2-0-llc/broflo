// RED-FIRST PROBE (removed in the next commit): proves the ops-platform scan
// reads the api's jest evidence and fails on a failing test.
describe('red-first probe', () => {
  it('fails on purpose', () => {
    expect(true).toBe(false);
  });
});
