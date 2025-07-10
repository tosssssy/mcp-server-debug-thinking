export function createJsonResponse(
  data: unknown,
  error?: boolean
): {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
} {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
    ...(error && { isError: true }),
  };
}
