import { describe, it, expect } from "vitest";
import { createJsonResponse } from "../../utils/format.js";

describe("format utils", () => {
  describe("createJsonResponse", () => {
    it("should create a valid MCP response for success", () => {
      const data = {
        success: true,
        message: "Operation completed",
        value: 42,
      };

      const response = createJsonResponse(data);

      expect(response).toHaveProperty("content");
      expect(response.content).toHaveLength(1);
      expect(response.content[0].type).toBe("text");

      const parsedText = JSON.parse(response.content[0].text);
      expect(parsedText).toEqual(data);
      expect(response.isError).toBeUndefined();
    });

    it("should create a valid MCP response for error", () => {
      const errorData = {
        success: false,
        message: "Something went wrong",
        code: "ERROR_001",
      };

      const response = createJsonResponse(errorData, true);

      expect(response).toHaveProperty("content");
      expect(response.content).toHaveLength(1);
      expect(response.content[0].type).toBe("text");

      const parsedText = JSON.parse(response.content[0].text);
      expect(parsedText).toEqual(errorData);
      expect(response.isError).toBe(true);
    });

    it("should format JSON with proper indentation", () => {
      const data = {
        nested: {
          value: "test",
          array: [1, 2, 3],
        },
      };

      const response = createJsonResponse(data);
      const text = response.content[0].text;

      // Check for proper formatting
      expect(text).toContain('  "nested": {');
      expect(text).toContain('    "value": "test"');
      expect(text).toContain('    "array": [');
    });

    it("should handle null and undefined values", () => {
      const data = {
        nullValue: null,
        undefinedValue: undefined,
        zero: 0,
        emptyString: "",
        false: false,
      };

      const response = createJsonResponse(data);
      const parsedText = JSON.parse(response.content[0].text);

      expect(parsedText.nullValue).toBeNull();
      expect(parsedText.undefinedValue).toBeUndefined();
      expect(parsedText.zero).toBe(0);
      expect(parsedText.emptyString).toBe("");
      expect(parsedText.false).toBe(false);
    });

    it("should handle arrays", () => {
      const data = ["item1", "item2", "item3"];

      const response = createJsonResponse(data);
      const parsedText = JSON.parse(response.content[0].text);

      expect(Array.isArray(parsedText)).toBe(true);
      expect(parsedText).toEqual(data);
    });

    it("should handle complex nested structures", () => {
      const data = {
        graph: {
          nodes: [
            { id: "1", type: "problem", content: "Test" },
            { id: "2", type: "hypothesis", content: "Theory" },
          ],
          edges: [{ from: "1", to: "2", type: "hypothesizes" }],
        },
        metadata: {
          created: new Date("2024-01-01").toISOString(),
          version: "1.0.0",
        },
      };

      const response = createJsonResponse(data);
      const parsedText = JSON.parse(response.content[0].text);

      expect(parsedText.graph.nodes).toHaveLength(2);
      expect(parsedText.graph.edges).toHaveLength(1);
      expect(parsedText.metadata.version).toBe("1.0.0");
    });

    it("should handle circular references gracefully", () => {
      const data: Record<string, unknown> = { a: 1 };
      data.circular = data; // Create circular reference

      // JSON.stringify should throw an error for circular references
      expect(() => createJsonResponse(data)).toThrow();
    });

    it("should not include isError when error is false", () => {
      const data = { message: "Success" };
      const response = createJsonResponse(data, false);

      expect(response.isError).toBeUndefined();
    });

    it("should handle empty objects and arrays", () => {
      const emptyObj = {};
      const emptyArr: unknown[] = [];

      const objResponse = createJsonResponse(emptyObj);
      const arrResponse = createJsonResponse(emptyArr);

      expect(JSON.parse(objResponse.content[0].text)).toEqual({});
      expect(JSON.parse(arrResponse.content[0].text)).toEqual([]);
    });
  });
});
