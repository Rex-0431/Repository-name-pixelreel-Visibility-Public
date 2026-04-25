const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const cors = require('cors');
const Razorpay = require('razorpay');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/outputs', express.static('outputs'));

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
if (!fs.existsSync('outputs')) fs.mkdirSync('outputs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const upload = multer({ storage });

const razorpay = new Razorpay({
  key_id: 'YOUR_RAZORPAY_KEY_ID',
  key_secret: 'YOUR_RAZORPAY_KEY_SECRET'
});

app.post('/create-order', async (req, res) => {
  try {
    const order = await razorpay.orders.create({
      amount: 2900,
      currency: 'INR',
      receipt: uuidv4()
    });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/upload', upload.array('images', 20), (req, res) => {
  const files = req.files.map(f => f.filename);
  res.json({ files });
});

app.post('/create-video', async (req, res) => {
  const { files, duration, text, music } = req.body;
  const outputId = uuidv4();
  const outputPath = `outputs/${outputId}.mp4`;
  const listFile = `uploads/${outputId}_list.txt`;

  const listContent = files.map(f =>
    `file '${path.resolve('uploads/' + f)}'\nduration ${duration || 3}`
  ).join('\n');
  fs.writeFileSync(listFile, listContent);

  let command = ffmpeg()
    .input(listFile)
    .inputOptions(['-f concat', '-safe 0'])
    .outputOptions([
      '-vf scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2',
      '-c:v libx264',
      '-pix_fmt yuv420p',
      '-r 30'
    ]);

  if (text) {
    command = command.outputOptions([
      `-vf drawtext=text='${text}':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=h-th-30:box=1:boxcolor=black@0.5`
    ]);
  }

  command
    .output(outputPath)
    .on('end', () => {
      fs.unlinkSync(listFile);
      res.json({
        success: true,
        url: `https://pixelreel.onrender.com/outputs/${outputId}.mp4`
      });
    })
    .on('error', (err) => {
      res.status(500).json({ error: err.message });
    })
    .run();
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(3000, () => {
  console.log('PixelReel server running on port 3000');
});