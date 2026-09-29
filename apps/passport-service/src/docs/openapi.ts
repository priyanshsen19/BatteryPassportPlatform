import {
  BATTERY_CATEGORIES,
  BATTERY_STATUSES,
  PASSPORT_SORT_FIELDS,
  bearerAuthScheme,
  errorEnvelopeSchema,
  errorResponses,
  healthPath,
  successResponse,
} from '@bpp/shared';

const str = { type: 'string' };

const passportDataSchema = {
  type: 'object',
  required: ['generalInformation', 'materialComposition', 'carbonFootprint'],
  properties: {
    generalInformation: {
      type: 'object',
      properties: {
        batteryIdentifier: str,
        batteryModel: { type: 'object', properties: { id: str, modelName: str } },
        batteryMass: { type: 'number', description: 'kg' },
        batteryCategory: { type: 'string', enum: BATTERY_CATEGORIES },
        batteryStatus: { type: 'string', enum: BATTERY_STATUSES },
        manufacturingDate: { type: 'string', format: 'date' },
        manufacturingPlace: str,
        warrantyPeriod: { type: 'string', description: 'Years' },
        manufacturerInformation: {
          type: 'object',
          properties: { manufacturerName: str, manufacturerIdentifier: str },
        },
      },
    },
    materialComposition: {
      type: 'object',
      properties: {
        batteryChemistry: str,
        criticalRawMaterials: { type: 'array', items: str },
        hazardousSubstances: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              substanceName: str,
              chemicalFormula: str,
              casNumber: { type: 'string', example: '21324-40-3' },
            },
          },
        },
      },
    },
    carbonFootprint: {
      type: 'object',
      properties: { totalCarbonFootprint: { type: 'number' }, measurementUnit: str, methodology: str },
    },
  },
};

const exampleData = {
  generalInformation: {
    batteryIdentifier: 'BP-2024-011',
    batteryModel: { id: 'LM3-BAT-2024', modelName: 'GMC WZX1' },
    batteryMass: 450,
    batteryCategory: 'EV',
    batteryStatus: 'Original',
    manufacturingDate: '2024-01-15',
    manufacturingPlace: 'Gigafactory Nevada',
    warrantyPeriod: '8',
    manufacturerInformation: { manufacturerName: 'Tesla Inc', manufacturerIdentifier: 'TESLA-001' },
  },
  materialComposition: {
    batteryChemistry: 'LiFePO4',
    criticalRawMaterials: ['Lithium', 'Iron'],
    hazardousSubstances: [
      { substanceName: 'Lithium Hexafluorophosphate', chemicalFormula: 'LiPF6', casNumber: '21324-40-3' },
    ],
  },
  carbonFootprint: {
    totalCarbonFootprint: 850,
    measurementUnit: 'kg CO2e',
    methodology: 'Life Cycle Assessment (LCA)',
  },
};

const examplePassport = {
  id: '6700f1c2a7d4e5f601234567',
  data: exampleData,
  createdBy: '6700f0a1a7d4e5f601234560',
  createdAt: '2024-10-05T10:00:00.000Z',
  updatedAt: '2024-10-05T10:00:00.000Z',
};

const requestBody = {
  required: true,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/PassportRequest' },
      example: { data: exampleData },
    },
  },
};

const idParameter = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string' },
  example: examplePassport.id,
};
const passportRef = { $ref: '#/components/schemas/Passport' };

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Battery Passport Service',
    version: '1.0.0',
    description:
      'Create, read, update and delete battery passports. Tokens are verified by calling the Auth Service ' +
      'over HTTP. Writes emit `passport.created`, `passport.updated` and `passport.deleted` events to the ' +
      '`battery-passport-events` Kafka topic.',
  },
  servers: [{ url: 'http://localhost:4002' }],
  tags: [{ name: 'Passports' }, { name: 'Health' }],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: bearerAuthScheme,
    schemas: {
      Error: errorEnvelopeSchema,
      PassportRequest: { type: 'object', required: ['data'], properties: { data: passportDataSchema } },
      Passport: {
        type: 'object',
        properties: {
          id: str,
          data: passportDataSchema,
          createdBy: str,
          updatedBy: str,
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    '/api/passports': {
      post: {
        tags: ['Passports'],
        summary: 'Create a passport',
        description: 'Roles: **admin**, **developer**. Emits `passport.created`.',
        requestBody,
        responses: {
          201: successResponse('Passport created', passportRef, examplePassport),
          ...errorResponses(400, 401, 403, 409, 422),
        },
      },
      get: {
        tags: ['Passports'],
        summary: 'List passports',
        description:
          'All roles. Supports free-text search (battery identifier, model, manufacturer), ' +
          'filtering by category and status, and sorting.',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
          { name: 'q', in: 'query', schema: { type: 'string', maxLength: 100 }, example: 'BP-2024' },
          { name: 'category', in: 'query', schema: { type: 'string', enum: BATTERY_CATEGORIES } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: BATTERY_STATUSES } },
          {
            name: 'sort',
            in: 'query',
            schema: { type: 'string', enum: PASSPORT_SORT_FIELDS, default: 'createdAt' },
          },
          { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
        ],
        responses: {
          200: successResponse(
            'Paginated passports',
            {
              type: 'object',
              properties: {
                items: { type: 'array', items: passportRef },
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
              },
            },
            { items: [examplePassport], page: 1, limit: 20, total: 1 },
          ),
          ...errorResponses(401, 403, 422),
        },
      },
    },
    '/api/passports/{id}': {
      parameters: [idParameter],
      get: {
        tags: ['Passports'],
        summary: 'Get a passport',
        description: 'All roles.',
        responses: {
          200: successResponse('The passport', passportRef, examplePassport),
          ...errorResponses(400, 401, 403, 404),
        },
      },
      put: {
        tags: ['Passports'],
        summary: 'Update a passport',
        description:
          'Roles: **admin**, **developer**. Replaces the passport `data`. Emits `passport.updated`.',
        requestBody,
        responses: {
          200: successResponse('Updated passport', passportRef, examplePassport),
          ...errorResponses(400, 401, 403, 404, 409, 422),
        },
      },
      delete: {
        tags: ['Passports'],
        summary: 'Delete a passport',
        description: 'Role: **admin** only. Emits `passport.deleted`.',
        responses: {
          200: successResponse(
            'Passport deleted',
            { type: 'object', properties: { id: str } },
            { id: examplePassport.id },
          ),
          ...errorResponses(400, 401, 403, 404),
        },
      },
    },
    '/health': healthPath,
  },
};
