from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from rembg import remove, new_session

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # for development only
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

session = new_session("isnet-general-use")

MAX_SIZE = 20 * 1024 * 1024  # 20MB
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}

@app.post("/remove-bg")
async def remove_bg(file: UploadFile = File(...)):
    # ✅ Validate file type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type '{file.content_type}'. Allowed: {ALLOWED_TYPES}"
        )

    input_data = await file.read()

    # ✅ Validate file size (after reading, so we know the true size)
    if len(input_data) > MAX_SIZE:
        raise HTTPException(
            status_code=400,
            detail="File too large. Maximum allowed size is 8MB."
        )

    output_data = remove(input_data, session=session)
    return Response(content=output_data, media_type="image/png")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
    # ✅ Nothing after this line — it's unreachable anyway