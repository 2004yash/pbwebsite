import { NextRequest, NextResponse } from "next/server";
import connectMongoDB from "@/lib/dbConnect";
import cloudinary from 'cloudinary';
import Credit from "@/models/Credit";

cloudinary.v2.config({
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
    api_secret: process.env.NEXT_PUBLIC_CLOUDINARY_API_SECRET,
});
/**
 * @swagger
 * /api/credit:
 *   post:
 *     summary: Create a new credit entry
 *     description: Uploads an image to Cloudinary and creates a new credit entry in the database.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name of the credit entry
 *               githubUrl:
 *                 type: string
 *                 format: uri
 *                 description: GitHub profile URL of the contributor
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Image file to be uploaded
 *     responses:
 *       201:
 *         description: Successfully created the credit entry
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 credit:
 *                   type: object
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Internal server error
 */

// Helper function to upload to Cloudinary using a buffer
function uploadToCloudinary(fileBuffer: Buffer): Promise<{ secure_url: string; public_id: string }> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.v2.uploader.upload_stream(
        { folder: 'credits' },
        (error, result) => {
          if (error) return reject(error);
          if (!result) return reject(new Error('Cloudinary upload failed'));
          resolve({
            secure_url: result.secure_url,
            public_id: result.public_id,
          });
        }
      );
      uploadStream.end(fileBuffer); // Write buffer data and end the stream
    });
  }

export async function POST(request: NextRequest) {
    try {
        await connectMongoDB();

        const formData = await request.formData();
        const name = formData.get('name') as string;
        const githubUrl = formData.get('githubUrl') as string;
        const file = formData.get('image') as File;

        if(!name  || !file || !githubUrl) {
            return NextResponse.json({error: 'Missing required fields'}, {status: 400});
        }

        const fileBuffer = Buffer.from(await file.arrayBuffer());

        const { secure_url , public_id } = await uploadToCloudinary(fileBuffer);

        const newCredit = new Credit({
            name,
            githubUrl,
            imageUrl: secure_url,
            publicId: public_id,
        });

        await newCredit.save();

        return NextResponse.json({success: true, credit: newCredit} , {status: 201});
    }
    catch(error) {
        console.log("Error creating credit:",error);
        return NextResponse.json({error : 'Failed to create credit'}, {status: 500});
    }
}