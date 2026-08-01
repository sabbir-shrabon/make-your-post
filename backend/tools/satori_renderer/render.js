const fs = require('fs');
const path = require('path');
const satori = require('satori').default || require('satori');
const { Resvg } = require('@resvg/resvg-js');

async function main() {
  const args = process.argv.slice(2);
  let jsonInput = '';

  if (args.length > 0 && fs.existsSync(args[0])) {
    jsonInput = fs.readFileSync(args[0], 'utf-8');
  } else {
    jsonInput = fs.readFileSync(0, 'utf-8');
  }

  if (!jsonInput) {
    console.error('No input JSON provided');
    process.exit(1);
  }

  const props = JSON.parse(jsonInput);
  const canvasW = props.canvas_w || 1080;
  const canvasH = props.canvas_h || 1080;
  const elements = props.elements || [];
  const overlayOpacity = props.overlay_opacity || 0.0;
  const palette = props.palette || {};

  // Load font
  const fontPath = path.join(__dirname, '..', '..', 'assets', 'fonts', 'Roboto-Bold.ttf');
  let fontBuffer;
  if (fs.existsSync(fontPath)) {
    fontBuffer = fs.readFileSync(fontPath);
  } else {
    // Fallback to system font if available
    const sysFontPath = 'C:\\Windows\\Fonts\\arial.ttf';
    fontBuffer = fs.readFileSync(sysFontPath);
  }

  // Determine background style
  const bgConfig = palette.background || {};
  let backgroundStyle = { backgroundColor: '#121212' };
  if (bgConfig.type === 'solid' && bgConfig.hex) {
    backgroundStyle = { backgroundColor: bgConfig.hex };
  } else if (bgConfig.type === 'gradient' && bgConfig.from && bgConfig.to) {
    backgroundStyle = { backgroundImage: `linear-gradient(to bottom, ${bgConfig.from}, ${bgConfig.to})` };
  }

  // Build Satori VNode tree
  const children = [];

  // Add contrast overlay scrim if opacity > 0
  if (overlayOpacity > 0) {
    children.push({
      type: 'div',
      props: {
        style: {
          position: 'absolute',
          top: 0,
          left: 0,
          width: `${canvasW}px`,
          height: `${canvasH}px`,
          backgroundColor: '#000000',
          opacity: overlayOpacity,
        }
      }
    });
  }

  // Add elements (text, shape, icon, image)
  for (const el of elements) {
    const elType = (el.type || '').toLowerCase();
    const x = el.x || 0;
    const y = el.y || 0;
    const w = el.w || 200;
    const h = el.h || 100;

    if (elType === 'text') {
      const align = el.align || 'left';
      let justifyContent = 'flex-start';
      if (align === 'center') justifyContent = 'center';
      if (align === 'right') justifyContent = 'flex-end';

      children.push({
        type: 'div',
        props: {
          style: {
            position: 'absolute',
            left: `${x}px`,
            top: `${y}px`,
            width: `${w}px`,
            height: `${h}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: justifyContent,
            color: el.color || '#FFFFFF',
            fontSize: `${el.font_size || 40}px`,
            fontWeight: 700,
            textAlign: align,
            lineHeight: 1.2,
          },
          children: el.content || ''
        }
      });
    } else if (elType === 'shape') {
      const shapeKind = String(el.resolved || el.description || 'rectangle').toLowerCase();
      let borderRadius = '8px';
      if (shapeKind.includes('pill') || shapeKind.includes('badge')) {
        borderRadius = `${Math.min(w, h) / 2}px`;
      } else if (shapeKind.includes('circle') || shapeKind.includes('bubble')) {
        borderRadius = '50%';
      }

      const accentHex = palette.accent || palette.primary || '#3b82f6';
      const opacityVal = (el.opacity !== undefined ? el.opacity : 80) / 100.0;

      children.push({
        type: 'div',
        props: {
          style: {
            position: 'absolute',
            left: `${x}px`,
            top: `${y}px`,
            width: `${w}px`,
            height: `${h}px`,
            backgroundColor: Array.isArray(accentHex) ? accentHex[0] : accentHex,
            borderRadius: borderRadius,
            opacity: opacityVal,
          }
        }
      });
    } else if (elType === 'icon' || elType === 'emoji') {
      const accentHex = palette.accent || '#f59e0b';
      const bgHex = Array.isArray(accentHex) ? accentHex[0] : accentHex;
      const symbol = String(el.resolved || el.description || '★');
      const textSymbol = symbol.includes('lucide:') || symbol.length > 4 ? '★' : symbol;

      children.push({
        type: 'div',
        props: {
          style: {
            position: 'absolute',
            left: `${x}px`,
            top: `${y}px`,
            width: `${w}px`,
            height: `${h}px`,
            borderRadius: '50%',
            backgroundColor: bgHex,
            opacity: 0.85,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontSize: `${Math.max(12, Math.floor(Math.min(w, h) * 0.45))}px`,
          },
          children: textSymbol
        }
      });
    } else if (['photo', 'cat_photo', 'library_image', 'background_asset'].includes(elType) || (el.resolved && el.resolved.startsWith('http'))) {
      if (el.resolved) {
        children.push({
          type: 'img',
          props: {
            src: el.resolved,
            style: {
              position: 'absolute',
              left: `${x}px`,
              top: `${y}px`,
              width: `${w}px`,
              height: `${h}px`,
              objectFit: 'cover',
            }
          }
        });
      }
    }
  }

  // Root Container
  const rootElement = {
    type: 'div',
    props: {
      style: {
        width: `${canvasW}px`,
        height: `${canvasH}px`,
        display: 'flex',
        position: 'relative',
        ...backgroundStyle,
      },
      children: children
    }
  };

  // Generate SVG via Satori
  const svg = await satori(rootElement, {
    width: canvasW,
    height: canvasH,
    fonts: [
      {
        name: 'Roboto',
        data: fontBuffer,
        weight: 700,
        style: 'normal',
      }
    ]
  });

  // Rasterize SVG to PNG via resvg
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: canvasW }
  });

  const pngBuffer = resvg.render().asPng();

  if (props.output_path) {
    fs.writeFileSync(props.output_path, pngBuffer);
  }

  // Output Base64 string to stdout
  const base64Str = pngBuffer.toString('base64');
  process.stdout.write(base64Str);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
