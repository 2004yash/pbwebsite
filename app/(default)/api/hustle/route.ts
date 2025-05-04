export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import axios from "axios";
import connectMongoDB from "@/lib/dbConnect";
import { LatestModel, LeaderboardModel } from "@/models/PbHustel";
import { lead } from "@/app/(default)/api/hustle/leaderboard";
import FireCrawlApp from "@mendable/firecrawl-js";
import {
  parseVJudgeContests,
  getLatestContestId,
  VJudgeContest,
} from "@/lib/server/vjudgeParser";
import { parseContestData } from "@/app/(default)/api/hustle/leaderboard";
import updateLeaderboard from "@/lib/server/test";

interface ContestRanking {
  rank: number;
  name: string;
  score: number;
}

interface LeaderboardUser {
  name: string;
  score: number;
  consistency: number;
  rank?: number;
}

interface LeaderboardData {
  rankings?: LeaderboardUser[];
  updatedAt?: Date;
  lastContestCode?: string;
}

/**
 * @swagger
 * /api/hustle/update:
 *   post:
 *     summary: Fetches and updates the leaderboard from VJudge.
 *     description: Fetches contest data from VJudge API, updates the leaderboard, and stores it in the database.
 *     tags:
 *      - Hustle
 *     responses:
 *       200:
 *         description: Successfully updated leaderboard
 *       400:
 *         description: Invalid response from VJudge or missing data.
 *       500:
 *         description: Error while processing or updating data.
 */

export async function PUT () {
    await updateLeaderboard();
    return NextResponse.json({ message: "Leaderboard update initiated." }, { status: 200 });
}


export async function POST() {
  try {
    await connectMongoDB();

    // Use FireCrawl to scrape contest data from VJudge
    const app = new FireCrawlApp({
      apiKey:
        process.env.FIRECRAWL_API_KEY,
    });

    const scrapeResult = await app.scrapeUrl(
      "https://vjudge.net/contest#category=public&running=0&title=&owner=Pbhustle",
      {
        formats: ["markdown"],
      }
    );

    // Parse the markdown to extract contest data using our utility function
    const contests = parseVJudgeContests(scrapeResult.markdown);

    console.log("Contests:", contests);

    // Get the latest contest ID
    const latestContestId = getLatestContestId(contests);

    if (!latestContestId) {
      return NextResponse.json(
        {
          error: "Failed to get the contest ID",
          message: "Contest ID not found",
        },
        { status: 400 }
      );
    }

    const leaderboardDoc = await LeaderboardModel.findOne({
      name: "leaderboard",
    });

    const existingData = leaderboardDoc as LeaderboardData | undefined;
    const lastContestCode = existingData?.lastContestCode;

    if (Number(lastContestCode) == Number(latestContestId)) {
      console.log("Leaderboard is already up-to-date.");
      return NextResponse.json({
        message: "Leaderboard is already up-to-date.",
      });
    }

    const scrapeResult2 = await app.scrapeUrl(
      `https://vjudge.net/contest/${Number(latestContestId)}#rank`,
      {
        formats: ["markdown"],
      }
    );

    const contestDetails = parseContestData(scrapeResult2.markdown);

    const latest: ContestRanking[] = contestDetails.participants.map(
      (user, index) => ({
      rank: index + 1,
      name: user.username.replace(/\\/g, ''),
      score: user.score,
      })
    );

    await LatestModel.findOneAndUpdate(
      { name: "latest" },
      {
        $set: {
          results: latest,
          updateTime: new Date(),
        },
      },
      { upsert: true }
    );

    let leaderboardRankings: LeaderboardUser[] = existingData?.rankings || [];

    latest.forEach(({ name, score }) => {
      const existingUser = leaderboardRankings.find(
        (user) => user.name === name
      );
      if (existingUser) {
        existingUser.score += score;
        existingUser.consistency += 1;
      } else {
        leaderboardRankings.push({ name, score, consistency: 1 });
      }
    });

    leaderboardRankings.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.consistency !== a.consistency) return b.consistency - a.consistency;
      return (a.rank || 0) - (b.rank || 0);
    });

    leaderboardRankings.forEach((user, index) => {
      user.rank = index + 1;
    });

    await LeaderboardModel.findOneAndUpdate(
      { name: "leaderboard" },
      {
        $set: {
          rankings: leaderboardRankings,
          updatedAt: new Date(),
          lastContestCode: latestContestId,
        },
      },
      { upsert: true }
    );


    return NextResponse.json(
      {
        message: "Leaderboard updated successfully",
        data: {
          latestContestId,
          latestContestTitle: contestDetails.title,
          latestContestBeginTime: contestDetails.beginTime,
          latestContestEndTime: contestDetails.endTime,
          latestContestDuration: contestDetails.duration,
          latestContestStatus: contestDetails.status,
          lastContestCode: latestContestId,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error during scraping:", error);
    return NextResponse.json(
      {
        error: "Failed to update leaderboard",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * @swagger
 * /api/hustle/fetch:
 *   get:
 *     summary: Fetches the latest and leaderboard data from the database.
 *     description: Fetches the latest contest results and leaderboard rankings from the database.
 *     tags:
 *      - Hustle
 *     responses:
 *       200:
 *         description: Successfully fetched hustle data
 *       500:
 *         description: Error while fetching data from the database.
 */
export async function GET() {
  try {
    await connectMongoDB();
    const latestDoc = await LatestModel.findOne({ name: "latest" });
    const leaderboardDoc = await LeaderboardModel.findOne({
      name: "leaderboard",
    });

    return new Response(
      JSON.stringify({
        message: "Fetched hustle data successfully",
        data: {
          latest: latestDoc,
          leaderboard: leaderboardDoc,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Database error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch hustle data",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
