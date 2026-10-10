// Records the 12-second test clip (video and sound) and a poster inside a browser, because
// this project keeps no ffmpeg on the developer's machine. Run with playwright-cli:
//   playwright-cli open about:blank --browser=msedge
//   playwright-cli --raw run-code --filename=make-clip.js > clip.json
// then decode `video` (base64) into clip.mp4. The result is committed, so this is rarely needed.
async (page) => {
  return await page.evaluate(async () => {
    const types = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4'];
    const type = types.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
    if (!type) return { error: 'this browser cannot record MP4' };
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    let n = 0;
    const paint = () => {
      ctx.fillStyle = `hsl(${(n * 3) % 360} 70% 40%)`;
      ctx.fillRect(0, 0, 640, 360);
      ctx.fillStyle = '#fff';
      ctx.font = '48px sans-serif';
      ctx.fillText('Test clip ' + Math.floor(n / 25) + 's', 40, 190);
      ctx.fillRect((n * 6) % 600, 260, 40, 40);
      n++;
    };
    paint();
    const draw = setInterval(paint, 40);
    const audio = new AudioContext();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    gain.gain.value = 0.05;
    const dest = audio.createMediaStreamDestination();
    osc.connect(gain).connect(dest);
    osc.start();
    const stream = new MediaStream([
      ...canvas.captureStream(25).getVideoTracks(),
      ...dest.stream.getAudioTracks(),
    ]);
    const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 600000 });
    const chunks = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    const done = new Promise((r) => (rec.onstop = r));
    rec.start();
    await new Promise((r) => setTimeout(r, 12500));
    rec.stop();
    await done;
    clearInterval(draw);
    const buf = new Uint8Array(await new Blob(chunks).arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000)
      s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { type, size: buf.length, video: btoa(s) };
  });
};
