describe('API Client Integration', () => {
  describe('GitHub URL parsing', () => {
    it('should parse GitHub HTTPS URLs correctly', () => {
      const url = 'https://github.com/owner/repo';
      const match = url.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
      expect(match).not.toBeNull();
      if (match) {
        expect(match[1]).toBe('owner');
        expect(match[2]).toBe('repo');
      }
    });

    it('should parse GitHub SSH URLs correctly', () => {
      const url = 'git@github.com:owner/repo.git';
      const match = url.match(/github\.com:([^\/]+)\/([^\/\.]+)/);
      expect(match).not.toBeNull();
      if (match) {
        expect(match[1]).toBe('owner');
        expect(match[2]).toBe('repo');
      }
    });
  });

  describe('GitLab URL parsing', () => {
    it('should parse GitLab HTTPS URLs correctly', () => {
      const url = 'https://gitlab.com/owner/repo';
      const match = url.match(/gitlab\.com\/([^\/]+\/[^\/\.]+)/);
      expect(match).not.toBeNull();
      if (match) {
        expect(match[1]).toBe('owner/repo');
      }
    });

    it('should parse GitLab SSH URLs correctly', () => {
      const url = 'git@gitlab.com:owner/repo.git';
      const match = url.match(/gitlab\.com:([^\/]+\/[^\/\.]+)/);
      expect(match).not.toBeNull();
      if (match) {
        expect(match[1]).toBe('owner/repo');
      }
    });
  });
});
