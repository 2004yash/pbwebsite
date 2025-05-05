interface Problem {
  id: string;
  origin: string;
  title: string;
  solved: number;
  attempted: number;
}

interface Submission {
  time: string;
  attempts: number;
}

interface Participant {
  rank: number;
  username: string;
  displayName?: string;
  score: number;
  penalty: string;
  solvedProblems: Record<string, Submission>;
  failedProblems: Record<string, number>;
}

interface ContestData {
  id: string;
  title: string;
  beginTime: string;
  endTime: string;
  duration: string;
  status: string;
  problems: Problem[];
  participants: Participant[];
}

/**
 * Parses a contest data markdown and returns structured JSON data
 * @param markdownData The contest data in markdown format
 * @returns Structured contest data as JSON
 */
export function parseContestData(markdownData: string): ContestData {
  // Extract basic contest info
  const titleMatch = markdownData.match(/### ([^\n]+)/);
  const beginMatch = markdownData.match(/\*\*Begin:\*\* ([^\n]+)/);
  const endMatch = markdownData.match(/\*\*End:\*\* ([^\n]+)/);
  const durationMatch = markdownData.match(/\*\*End:\*\* [^\n]+\n\n([^\n]+)/);
  const statusMatch = markdownData.match(/([^\n]+)\n\n- \[Overview\]/);
  const idMatch = markdownData.match(/\/contest\/(\d+)#/);

  // Extract problems
  const problems: Problem[] = [];
  const problemsRegex =
    /\| [^|]+ \| \[(\d+)\]\([^)]+\) \/ \[(\d+)\]\([^)]+\) \| ([A-Z]) \| \[[^[]+\]\([^)]+\) \| \[([^[]+)\]\(/g;
  let problemMatch;

  while ((problemMatch = problemsRegex.exec(markdownData)) !== null) {
    const solved = parseInt(problemMatch[1], 10);
    const attempted = parseInt(problemMatch[2], 10);
    const id = problemMatch[3];
    const title = problemMatch[4];

    // Extract origin from nearby text
    const originRegex = new RegExp(
      `\\| [^|]+ \\| \\[\\d+\\]\\([^)]+\\) / \\[\\d+\\]\\([^)]+\\) \\| ${id} \\| \\[([^\\]]+)\\]`
    );
    const originMatch = markdownData.match(originRegex);
    const origin = originMatch ? originMatch[1] : "";

    problems.push({
      id,
      origin,
      title,
      solved,
      attempted,
    });
  }

  // Extract participants
  const participants: Participant[] = [];
  const participantRows = markdownData.match(/^\| \d+ \|.*$/gm);

  if (participantRows) {
    for (const row of participantRows) {
      // Skip header rows or non-participant rows
      if (!row.match(/^\| \d+ \| .*$/)) continue;

      const columns = row.split("|").map((col) => col.trim());
      if (columns.length < 9) continue;

      const rank = parseInt(columns[1], 10);

      // More precise extraction of username and display name
      // Format is typically: ![avatar](URL)[Username](https://vjudge.net/user/Username "Username DisplayName")
      // or: ![avatar](https://cravatar.cn/avatar/...)[Username (DisplayName)](https://vjudge.net/user/Username "Username DisplayName")

      // First attempt to extract username and display name from the full format
      const fullPattern =
        /\!\[avatar\]\([^)]+\)\[([^\]]+)(?:\s\(([^)]+)\))?\]\([^)]+\)/;
      const fullMatch = columns[2].match(fullPattern);

      let username = "";
      let displayName: string | undefined = undefined;

      if (fullMatch) {
        username = fullMatch[1];
        displayName = fullMatch[2] || undefined;
      } else {
        // Try simpler pattern as fallback
        const simpleUsernameMatch = columns[2].match(/\[([^\(\]]+)\]/);
        if (simpleUsernameMatch) {
          username = simpleUsernameMatch[1];
        }

        const simpleDisplayNameMatch = columns[2].match(/\(([^)]+)\)/);
        if (simpleDisplayNameMatch) {
          displayName = simpleDisplayNameMatch[1];
        }
      }

      const score = parseInt(columns[3], 10);
      const penalty = columns[4];

      const solvedProblems: Record<string, Submission> = {};
      const failedProblems: Record<string, number> = {};

      // Process problem columns (A through E)
      for (let i = 0; i < 5; i++) {
        const problemId = String.fromCharCode(65 + i); // A, B, C, D, E
        const problemData = columns[5 + i];

        if (!problemData || problemData === "") continue;

        // Check if the problem was solved
        const solvedMatch = problemData.match(
          /(\d+:\d+:\d+)(?:<br>\((-\d+)\))?/
        );
        if (solvedMatch) {
          const submissionTime = solvedMatch[1];
          const attemptsStr = solvedMatch[2];

          solvedProblems[problemId] = {
            time: submissionTime,
            attempts: attemptsStr ? Math.abs(parseInt(attemptsStr, 10)) : 0,
          };
          continue;
        }

        // Check if there were failed attempts
        const failedMatch = problemData.match(/\((-\d+)\)/);
        if (failedMatch) {
          const attempts = Math.abs(parseInt(failedMatch[1], 10));
          failedProblems[problemId] = attempts;
        }
      }

      participants.push({
        rank,
        username,
        ...(displayName && { displayName }),
        score,
        penalty,
        solvedProblems,
        failedProblems,
      });
    }
  }

  // Construct the final contest data object
  const contestData: ContestData = {
    id: idMatch ? idMatch[1] : "",
    title: titleMatch ? titleMatch[1] : "",
    beginTime: beginMatch ? beginMatch[1] : "",
    endTime: endMatch ? endMatch[1] : "",
    duration: durationMatch ? durationMatch[1] : "",
    status: statusMatch ? statusMatch[1] : "",
    problems,
    participants,
  };

  return contestData;
}

/**
 * Example usage:
 *
 * const markdownData = `...markdown content...`;
 * const contestData = parseContestData(markdownData);
 * console.log(JSON.stringify(contestData, null, 2));
 */
