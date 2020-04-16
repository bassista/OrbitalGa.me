import {ArrayBufferBuilder, ArrayBufferReader} from './arrayBufferBuilder';
import {assertType, Utils} from '../utils/utils';
import {AB, ABFlags, ABScalars, Discriminate} from './arrayBufferSchemaTypes';
import {unreachable} from '../utils/unreachable';
const readerScalarLookup = {
  uint8: (reader: ArrayBufferReader) => reader.readUint8(),
  uint16: (reader: ArrayBufferReader) => reader.readUint16(),
  uint32: (reader: ArrayBufferReader) => reader.readUint32(),
  int8: (reader: ArrayBufferReader) => reader.readInt8(),
  int16: (reader: ArrayBufferReader) => reader.readInt16(),
  int32: (reader: ArrayBufferReader) => reader.readInt32(),
  float32: (reader: ArrayBufferReader) => reader.readFloat32(),
  float64: (reader: ArrayBufferReader) => reader.readFloat64(),
  boolean: (reader: ArrayBufferReader) => reader.readBoolean(),
  string: (reader: ArrayBufferReader) => reader.readString(),
  int32Optional: (reader: ArrayBufferReader) => reader.readInt32Optional(),
  int8Optional: (reader: ArrayBufferReader) => reader.readInt8Optional(),
};
const readerFlagLookup = {
  enum: (reader: ArrayBufferReader, schema: ABFlags) => {
    const enumValue = reader.readUint8();
    return Object.keys(schema).find((enumKey) => (schema as any)[enumKey] === enumValue);
  },
  bitmask: (reader: ArrayBufferReader, schema: ABFlags) => {
    const maskObj: any = {};
    const bits = reader.readBits();
    for (const maskKey of Object.keys(schema)) {
      if (maskKey === 'flag') continue;
      maskObj[maskKey] = bits[(schema as any)[maskKey]];
    }
    return maskObj;
  },
  'array-uint8': (reader: ArrayBufferReader, schema: Discriminate<ABFlags, 'flag', 'array-uint8'>) => {
    const length = reader.readUint8();
    const items = [];
    for (let i = 0; i < length; i++) {
      const item = ArrayBufferSchema.readSchemaBuffer(reader, schema.elements);
      items.push(item);
    }
    return items;
  },
  'array-uint16': (reader: ArrayBufferReader, schema: Discriminate<ABFlags, 'flag', 'array-uint16'>) => {
    const length = reader.readUint16();
    const items = [];
    for (let i = 0; i < length; i++) {
      const item = ArrayBufferSchema.readSchemaBuffer(reader, schema.elements);
      items.push(item);
    }
    return items;
  },
  'type-lookup': (reader: ArrayBufferReader, schema: Discriminate<ABFlags, 'flag', 'type-lookup'>) => {
    const type = reader.readUint8();
    for (const key of Object.keys(schema.elements)) {
      if (schema.elements[key].type === type) {
        return {type: key, ...ArrayBufferSchema.readSchemaBuffer(reader, schema.elements[key] as any)};
      }
    }
    throw new Error('Schema not found: Type ' + type);
  },
  'entity-type-lookup': (reader: ArrayBufferReader, schema: Discriminate<ABFlags, 'flag', 'entity-type-lookup'>) => {
    const entityType = reader.readUint8();
    for (const key of Object.keys(schema.elements)) {
      if (schema.elements[key].entityType === entityType) {
        return {entityType: key, ...ArrayBufferSchema.readSchemaBuffer(reader, schema.elements[key] as any)};
      }
    }
    throw new Error('Schema not found: Entity Type ' + entityType);
  },
};

const writerFlagLookup = {
  bitmask: (buff: ArrayBufferBuilder, schema: ABFlags, value: any) => {
    const bitmask: boolean[] = [];
    for (const maskKey of Object.keys(schema)) {
      if (maskKey === 'flag') continue;
      bitmask.push(value[maskKey]);
    }
    buff.addBits(...bitmask);
  },
  'array-uint8': (buff: ArrayBufferBuilder, schema: ABFlags, value: any) => {
    ArrayBufferSchema.addSchemaBuffer(buff, value, schema);
  },
  'array-uint16': (buff: ArrayBufferBuilder, schema: ABFlags, value: any) => {
    ArrayBufferSchema.addSchemaBuffer(buff, value, schema);
  },
  enum: (buff: ArrayBufferBuilder, schema: ABFlags, value: any) => {
    buff.addUint8(((schema as any)[value] as any) as number);
  },
  undefined: (buff: ArrayBufferBuilder, schema: ABFlags, value: any) => {
    ArrayBufferSchema.addSchemaBuffer(buff, value, schema);
  },
  'type-lookup': (buff: ArrayBufferBuilder, schema: ABFlags, value: any) => {
    ArrayBufferSchema.addSchemaBuffer(buff, value, schema);
  },
  'entity-type-lookup': (buff: ArrayBufferBuilder, schema: ABFlags, value: any) => {
    ArrayBufferSchema.addSchemaBuffer(buff, value, schema);
  },
};

export class ArrayBufferSchema {
  static debug = false;
  static addSchemaBuffer(buff: ArrayBufferBuilder, value: any, schema: ABFlags) {
    if (!schema) {
      debugger;
    }
    switch (schema.flag) {
      case 'array-uint8':
        buff.addUint8(value.length);
        for (const valueElement of value) {
          this.addSchemaBuffer(buff, valueElement, schema.elements);
        }
        return;
      case 'array-uint16':
        buff.addUint16(value.length);
        for (const valueElement of value) {
          this.addSchemaBuffer(buff, valueElement, schema.elements);
        }
        return;
    }
    let currentSchema = schema as any;
    if (currentSchema.flag === 'type-lookup') {
      buff.addUint8(currentSchema.elements[value.type].type);
      currentSchema = currentSchema.elements[value.type] as ABFlags;
    } else if (currentSchema.flag === 'entity-type-lookup') {
      buff.addUint8(currentSchema.elements[value.entityType].entityType);
      currentSchema = currentSchema.elements[value.entityType] as ABFlags;
    }
    for (const key of Object.keys(currentSchema)) {
      if (key === 'type' || key === 'entityType') {
        continue;
      }
      const currentSchemaElement = (currentSchema as any)[key] as ABFlags;

      assertType<ABScalars>(currentSchemaElement);

      const lookup = {
        uint8: () => buff.addUint8(value[key]),
        uint16: () => buff.addUint16(value[key]),
        uint32: () => buff.addUint32(value[key]),
        int8: () => buff.addInt8(value[key]),
        int16: () => buff.addInt16(value[key]),
        int32: () => buff.addInt32(value[key]),
        float32: () => buff.addFloat32(value[key]),
        float64: () => buff.addFloat64(value[key]),
        boolean: () => buff.addBoolean(value[key]),
        string: () => buff.addString(value[key]),
        int32Optional: () => buff.addInt32Optional(value[key]),
        int8Optional: () => buff.addInt8Optional(value[key]),
      };

      if (currentSchemaElement in lookup) {
        (lookup as any)[currentSchemaElement]();
      } else {
        (writerFlagLookup as any)[currentSchemaElement.flag as any](buff, currentSchemaElement, value[key]);
      }
    }
  }

  static readSchemaBuffer(reader: ArrayBufferReader, schemaO: ABFlags): any {
    assertType<ABScalars>(schemaO);
    if (schemaO in readerScalarLookup) {
      return (readerScalarLookup as any)[schemaO](reader);
    } else {
      if (!schemaO.flag) {
        const obj: any = {};
        for (const key of Object.keys(schemaO)) {
          if (key === 'type' || key === 'entityType') {
            continue;
          }
          const currentSchemaElement = (schemaO as any)[key] as ABFlags;
          obj[key] = this.readSchemaBuffer(reader, currentSchemaElement);
        }
        return obj;
      }
      if (schemaO.flag in readerFlagLookup) {
        return readerFlagLookup[schemaO.flag](reader, schemaO as any);
      }
      throw new Error('bad ');
    }
  }

  static startAddSchemaBuffer(value: any, schema: any) {
    const buf = new ArrayBufferBuilder(1000);
    ArrayBufferSchema.addSchemaBuffer(buf, value, schema);
    return buf.buildBuffer();
  }

  static startReadSchemaBuffer(buffer: ArrayBuffer | ArrayBufferLike, schema: any): any {
    this.log('start read buffer');
    return this.readSchemaBuffer(new ArrayBufferReader(buffer), schema);
  }

  private static log(...messages: string[]) {
    if (this.debug) console.log(...messages);
  }
}
