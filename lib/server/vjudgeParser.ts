/**
 * Utility functions for parsing VJudge contest data from markdown
 */

export interface VJudgeContest {
  id: string;
  title: string;
  beginTime: string;
  length: string;
  owner: string;
}

/**
 * Safely extracts text from markdown links [text](url) or returns the original text
 * @param text The text that might contain markdown links
 * @returns The extracted text without markdown formatting
 */
function extractTextFromMarkdown(text: string | undefined): string {
  if (!text) return "";

  // Try to match [text](url) pattern or [text] pattern
  const linkMatch = text.match(/\[(.*?)\](?:\(.*?\))?/);
  return linkMatch ? linkMatch[1] : text;
}

/**
 * Parses the markdown table from VJudge to extract contest information
 * @param markdown The markdown string from VJudge
 * @returns Array of contest objects with parsed information
 */
export function parseVJudgeContests(markdown: string): VJudgeContest[] {
  const contests: VJudgeContest[] = [];

  try {
    if (!markdown) {
      console.warn("No markdown content provided to parse");
      return [];
    }

    // Find the table rows - looks for lines that start with | followed by numbers (contest IDs)
    const rows = markdown.match(/\|\s*\d+\s*\|.*\|/g);

    if (!rows) {
      console.warn("No table rows found in the markdown");
      return [];
    }

    for (const row of rows) {
      try {
        // Extract columns from the row
        const columns = row
          .split("|")
          .map((col) => col.trim())
          .filter(Boolean);

        // Ensure we have enough columns before accessing them
        if (columns.length >= 6) {
          const id = columns[0] || "";

          // Extract title - remove the Markdown link syntax if present
          const title = extractTextFromMarkdown(columns[2]);

          // Extract begin time - find the date pattern in the string
          let beginTime = "";
          if (columns[4]) {
            const dateMatch = columns[4].match(
              /(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/
            );
            beginTime = dateMatch ? dateMatch[1] : columns[4];
          }

          const length = columns[5] || "";

          // Safely extract owner using the helper function
          const owner =
            columns.length > 6 ? extractTextFromMarkdown(columns[6]) : "";

          contests.push({
            id,
            title,
            beginTime,
            length,
            owner,
          });
        } else {
          console.warn(`Skipping row with insufficient columns: ${row}`);
        }
      } catch (rowError) {
        console.error("Error processing row:", rowError);
        // Continue with the next row
      }
    }
  } catch (error) {
    console.error("Error parsing VJudge contests:", error);
  }

  return contests;
}

/**
 * Gets the latest contest ID from the parsed contests
 * @param contests Array of VJudgeContest objects
 * @returns The ID of the latest contest or null if no contests are available
 */
export function getLatestContestId(contests: VJudgeContest[]): string | null {
  if (!contests || contests.length === 0) {
    return null;
  }

  // The first contest in the array is typically the latest one
  return contests[0].id;
}
