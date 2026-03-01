import fc from 'fast-check';

describe('Frontend Setup', () => {
  it('should have Jest configured correctly', () => {
    expect(true).toBe(true);
  });

  it('should have fast-check available for property-based testing', () => {
    fc.assert(
      fc.property(fc.integer(), (n) => {
        return n === n;
      })
    );
  });

  it('should support TypeScript and JSX', () => {
    const testValue: string = 'TypeScript works';
    expect(typeof testValue).toBe('string');
  });
});
