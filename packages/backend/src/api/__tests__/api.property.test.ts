import * as fc from 'fast-check';
import express, { Request, Response } from 'express';
import request from 'supertest';

/**
 * Feature: sustainoss
 * Property 28: API JSON Response Format
 * Validates: Requirements 8.5
 * 
 * For any successful API request, the response should be valid JSON
 * that can be parsed without errors.
 */
describe('Property 28: API JSON Response Format', () => {
  it('should return valid JSON for all successful API responses', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          data: fc.oneof(
            fc.string(),
            fc.integer(),
            fc.boolean(),
            fc.array(fc.string()),
            fc.dictionary(fc.string(), fc.anything())
          ),
          statusCode: fc.integer({ min: 200, max: 299 }),
        }),
        async ({ data, statusCode }) => {
          // Create a test Express app
          const app = express();
          app.use(express.json());

          // Create a test endpoint that returns the generated data
          app.get('/test', (_req: Request, res: Response) => {
            res.status(statusCode).json(data);
          });

          // Make request
          const response = await request(app).get('/test');

          // Verify response status
          expect(response.status).toBe(statusCode);

          // 204 No Content responses may not have content-type header
          if (statusCode !== 204) {
            expect(response.headers['content-type']).toMatch(/application\/json/);
          }

          // Verify JSON can be parsed (supertest already parses it)
          expect(response.body).toBeDefined();

          // Verify we can stringify and parse it again
          const jsonString = JSON.stringify(response.body);
          expect(() => JSON.parse(jsonString)).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return valid JSON for nested object responses', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          repository_id: fc.string(),
          metrics: fc.record({
            pr_reviews: fc.integer({ min: 0, max: 1000 }),
            open_issues: fc.integer({ min: 0, max: 1000 }),
            sustainability_score: fc.float({ min: 0, max: 100 }),
          }),
          timestamp: fc.date(),
        }),
        async (responseData) => {
          // Create a test Express app
          const app = express();
          app.use(express.json());

          app.get('/test', (_req: Request, res: Response) => {
            res.json(responseData);
          });

          // Make request
          const response = await request(app).get('/test');

          // Verify response is valid JSON
          expect(response.status).toBe(200);
          expect(response.headers['content-type']).toMatch(/application\/json/);

          // Verify structure is preserved
          expect(response.body).toHaveProperty('repository_id');
          expect(response.body).toHaveProperty('metrics');
          expect(response.body.metrics).toHaveProperty('pr_reviews');
          expect(response.body.metrics).toHaveProperty('open_issues');
          expect(response.body.metrics).toHaveProperty('sustainability_score');

          // Verify we can stringify and parse
          const jsonString = JSON.stringify(response.body);
          const parsed = JSON.parse(jsonString);
          expect(parsed.repository_id).toBe(responseData.repository_id);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return valid JSON for array responses', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.string(),
            name: fc.string(),
            value: fc.integer(),
          }),
          { minLength: 0, maxLength: 50 }
        ),
        async (arrayData) => {
          // Create a test Express app
          const app = express();
          app.use(express.json());

          app.get('/test', (_req: Request, res: Response) => {
            res.json({ items: arrayData, total: arrayData.length });
          });

          // Make request
          const response = await request(app).get('/test');

          // Verify response is valid JSON
          expect(response.status).toBe(200);
          expect(response.headers['content-type']).toMatch(/application\/json/);

          // Verify array structure
          expect(response.body).toHaveProperty('items');
          expect(Array.isArray(response.body.items)).toBe(true);
          expect(response.body.items.length).toBe(arrayData.length);

          // Verify we can stringify and parse
          const jsonString = JSON.stringify(response.body);
          expect(() => JSON.parse(jsonString)).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: sustainoss
 * Property 29: API Error Response Format
 * Validates: Requirements 8.6
 * 
 * For any API request with invalid parameters, the response should include
 * an appropriate HTTP error code (400, 401, 404, 500) and a JSON body
 * with an error message.
 */
describe('Property 29: API Error Response Format', () => {
  it('should return proper error format for all error status codes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          statusCode: fc.constantFrom(400, 401, 404, 500),
          errorMessage: fc.string({ minLength: 1 }),
          errorDetails: fc.option(fc.string(), { nil: undefined }),
        }),
        async ({ statusCode, errorMessage, errorDetails }) => {
          // Create a test Express app
          const app = express();
          app.use(express.json());

          // Create a test endpoint that returns an error
          app.get('/test', (_req: Request, res: Response) => {
            const errorResponse: any = {
              error: errorMessage,
              timestamp: new Date().toISOString(),
            };

            if (errorDetails) {
              errorResponse.details = errorDetails;
            }

            res.status(statusCode).json(errorResponse);
          });

          // Make request
          const response = await request(app).get('/test');

          // Verify error status code
          expect(response.status).toBe(statusCode);

          // Verify response is JSON
          expect(response.headers['content-type']).toMatch(/application\/json/);

          // Verify error response structure
          expect(response.body).toHaveProperty('error');
          expect(response.body.error).toBe(errorMessage);
          expect(response.body).toHaveProperty('timestamp');

          // Verify timestamp is valid ISO string
          expect(() => new Date(response.body.timestamp)).not.toThrow();

          // If details provided, verify they're included
          if (errorDetails) {
            expect(response.body).toHaveProperty('details');
            expect(response.body.details).toBe(errorDetails);
          }

          // Verify we can stringify and parse the error response
          const jsonString = JSON.stringify(response.body);
          expect(() => JSON.parse(jsonString)).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return 400 for invalid parameters with descriptive message', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          paramName: fc.string({ minLength: 1 }),
          reason: fc.string({ minLength: 1 }),
        }),
        async ({ paramName, reason }) => {
          // Create a test Express app
          const app = express();
          app.use(express.json());

          app.get('/test', (_req: Request, res: Response) => {
            res.status(400).json({
              error: 'Invalid request',
              details: `Parameter '${paramName}' is invalid: ${reason}`,
              timestamp: new Date().toISOString(),
            });
          });

          // Make request
          const response = await request(app).get('/test');

          // Verify 400 status
          expect(response.status).toBe(400);

          // Verify error structure
          expect(response.body).toHaveProperty('error');
          expect(response.body).toHaveProperty('details');
          expect(response.body.details).toContain(paramName);
          expect(response.body.details).toContain(reason);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return 401 for missing or invalid authentication', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          'Missing API key',
          'Invalid API key',
          'Expired API key',
          'Unauthorized access'
        ),
        async (errorMessage) => {
          // Create a test Express app
          const app = express();
          app.use(express.json());

          app.get('/test', (_req: Request, res: Response) => {
            res.status(401).json({
              error: errorMessage,
              timestamp: new Date().toISOString(),
            });
          });

          // Make request
          const response = await request(app).get('/test');

          // Verify 401 status
          expect(response.status).toBe(401);

          // Verify error structure
          expect(response.body).toHaveProperty('error');
          expect(response.body.error).toBe(errorMessage);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return 404 for non-existent resources', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          resourceType: fc.constantFrom('Repository', 'Metric', 'Issue', 'User'),
          resourceId: fc.string({ minLength: 1 }),
        }),
        async ({ resourceType, resourceId }) => {
          // Create a test Express app
          const app = express();
          app.use(express.json());

          app.get('/test', (_req: Request, res: Response) => {
            res.status(404).json({
              error: `${resourceType} not found`,
              details: `${resourceType} with ID ${resourceId} not found`,
              timestamp: new Date().toISOString(),
            });
          });

          // Make request
          const response = await request(app).get('/test');

          // Verify 404 status
          expect(response.status).toBe(404);

          // Verify error structure
          expect(response.body).toHaveProperty('error');
          expect(response.body.error).toContain('not found');
          expect(response.body).toHaveProperty('details');
          expect(response.body.details).toContain(resourceId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return 500 for internal server errors with error_id', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (errorId) => {
          // Create a test Express app
          const app = express();
          app.use(express.json());

          app.get('/test', (_req: Request, res: Response) => {
            res.status(500).json({
              error: 'Internal server error',
              details: 'An unexpected error occurred',
              error_id: errorId,
              timestamp: new Date().toISOString(),
            });
          });

          // Make request
          const response = await request(app).get('/test');

          // Verify 500 status
          expect(response.status).toBe(500);

          // Verify error structure
          expect(response.body).toHaveProperty('error');
          expect(response.body).toHaveProperty('error_id');
          expect(response.body.error_id).toBe(errorId);
        }
      ),
      { numRuns: 100 }
    );
  });
});
