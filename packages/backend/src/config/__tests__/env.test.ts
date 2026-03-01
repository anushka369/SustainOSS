import { config } from '../env.js';

describe('Environment Configuration', () => {
  it('should load configuration with default values', () => {
    expect(config).toBeDefined();
    expect(config.env).toBeDefined();
    expect(config.port).toBeGreaterThan(0);
    expect(config.db).toBeDefined();
    expect(config.db.host).toBeDefined();
    expect(config.db.port).toBeGreaterThan(0);
  });

  it('should have database configuration', () => {
    expect(config.db.database).toBeDefined();
    expect(config.db.user).toBeDefined();
    expect(config.db.password).toBeDefined();
  });

  it('should have security configuration', () => {
    expect(config.security).toBeDefined();
    expect(Array.isArray(config.security.corsOrigins)).toBe(true);
  });
});
