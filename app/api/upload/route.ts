import { put } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"
import { createServerClient, getAuthUser } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File
    const postId = formData.get("postId") as string

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Upload to Vercel Blob
    const blob = await put(`${user.id}/${Date.now()}-${file.name}`, file, {
      access: "public",
    })

    // Save attachment record to database if postId provided
    if (postId) {
      const { error: dbError } = await supabase.from("file_attachments").insert({
        filename: file.name,
        file_url: blob.url,
        file_type: file.type,
        file_size: file.size,
        post_id: postId,
        uploaded_by: user.id,
      })

      if (dbError) {
        console.error("Database error:", dbError)
        return NextResponse.json({ error: "Failed to save attachment" }, { status: 500 })
      }
    }

    return NextResponse.json({
      url: blob.url,
      filename: file.name,
      size: file.size,
      type: file.type,
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
