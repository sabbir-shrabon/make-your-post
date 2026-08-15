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
  const archetypeId = (props.archetype_id || '').toLowerCase().replace(/_/g, '-');
  const palette = props.palette || {};
  const fontPair = props.font_pair || {};

  // Load fonts
  const fontPathBold = path.join(__dirname, '..', '..', 'assets', 'fonts', 'Roboto-Bold.ttf');
  const fontPathRegular = path.join(__dirname, '..', '..', 'assets', 'fonts', 'Roboto-Regular.ttf');
  
  let fontBufferBold, fontBufferRegular;
  if (fs.existsSync(fontPathBold)) {
    fontBufferBold = fs.readFileSync(fontPathBold);
  } else {
    fontBufferBold = fs.readFileSync('C:\\Windows\\Fonts\\arialbd.ttf');
  }

  if (fs.existsSync(fontPathRegular)) {
    fontBufferRegular = fs.readFileSync(fontPathRegular);
  } else {
    fontBufferRegular = fs.readFileSync('C:\\Windows\\Fonts\\arial.ttf');
  }

  let rootElement;

  if (archetypeId === 'social-card') {
    // 1. Social Card Archetype
    const padding = Math.floor(canvasW * 0.055);
    const avatarSize = Math.floor(canvasW * 0.065);
    const brandName = props.brand_name || 'Creator';
    const handle = props.handle || '@creator';
    const headline = props.headline || '';
    const subheadline = props.subheadline || '';
    const badgeText = props.badge_text || '';
    const imgUrl = props.image_url || '';

    rootElement = {
      type: 'div',
      props: {
        style: {
          width: `${canvasW}px`,
          height: `${canvasH}px`,
          backgroundColor: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          padding: `${padding}px`,
          boxSizing: 'border-box',
          position: 'relative',
        },
        children: [
          // Header Bar
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                marginBottom: '24px',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: { display: 'flex', alignItems: 'center' },
                    children: [
                      {
                        type: 'div',
                        props: {
                          style: {
                            width: `${avatarSize}px`,
                            height: `${avatarSize}px`,
                            borderRadius: '50%',
                            backgroundColor: '#6366F1',
                            color: '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: `${Math.floor(avatarSize * 0.5)}px`,
                            fontWeight: 700,
                            marginRight: '16px',
                          },
                          children: (brandName[0] || 'C').toUpperCase(),
                        }
                      },
                      {
                        type: 'div',
                        props: {
                          style: { display: 'flex', flexDirection: 'column' },
                          children: [
                            {
                              type: 'span',
                              props: {
                                style: { color: '#111827', fontSize: `${Math.floor(canvasW * 0.026)}px`, fontWeight: 700 },
                                children: brandName
                              }
                            },
                            {
                              type: 'span',
                              props: {
                                style: { color: '#6B7280', fontSize: `${Math.floor(canvasW * 0.020)}px` },
                                children: handle
                              }
                            }
                          ]
                        }
                      }
                    ]
                  }
                },
                badgeText ? {
                  type: 'div',
                  props: {
                    style: {
                      backgroundColor: '#EEF2FF',
                      border: '1px solid #C7D2FE',
                      color: '#4F46E5',
                      fontSize: `${Math.floor(canvasW * 0.018)}px`,
                      fontWeight: 700,
                      padding: '6px 16px',
                      borderRadius: '16px',
                    },
                    children: badgeText.toUpperCase(),
                  }
                } : null
              ].filter(Boolean)
            }
          },
          // Headline
          {
            type: 'div',
            props: {
              style: {
                color: '#111827',
                fontSize: `${Math.floor(canvasW * 0.038)}px`,
                fontWeight: 700,
                lineHeight: 1.25,
                marginBottom: '12px',
              },
              children: headline
            }
          },
          // Subheadline if present
          subheadline ? {
            type: 'div',
            props: {
              style: {
                color: '#4B5563',
                fontSize: `${Math.floor(canvasW * 0.024)}px`,
                lineHeight: 1.3,
                marginBottom: '20px',
              },
              children: subheadline
            }
          } : null,
          // Framed Image
          imgUrl ? {
            type: 'img',
            props: {
              src: imgUrl,
              style: {
                width: '100%',
                flex: 1,
                borderRadius: '24px',
                border: '2px solid #E5E7EB',
                objectFit: 'cover',
              }
            }
          } : {
            type: 'div',
            props: {
              style: {
                width: '100%',
                flex: 1,
                borderRadius: '24px',
                backgroundColor: '#1F2937',
              }
            }
          }
        ].filter(Boolean)
      }
    };
  } else {
    const elements = props.elements || [];
    const children = [];
    const accentColor = palette.accent_color || palette.accent || '#F59E0B';
    const primaryColor = palette.primary || '#6366F1';
    const textOnDark = palette.text_on_dark || '#FFFFFF';

    for (const el of elements) {
      const elType = (el.type || '').toLowerCase();
      const role = (el.role || '').toLowerCase();
      const slot = (el.slot || '').toLowerCase();
      const x = el.x || 0;
      const y = el.y || 0;
      const w = el.w || 200;
      const h = el.h || 100;

      if (elType === 'text') {
        if (role === 'cta' || role === 'button' || slot === 'cta_text') {
          // Render Pill Button Component
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
                justifyContent: 'center',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      backgroundColor: accentColor,
                      color: textOnDark,
                      padding: '12px 28px',
                      borderRadius: '9999px',
                      fontSize: `${Math.max(16, el.font_size ? Math.min(el.font_size, 28) : 24)}px`,
                      fontWeight: 800,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      display: 'flex',
                      alignItems: 'center',
                      boxShadow: '0 8px 20px -4px rgba(0,0,0,0.3)',
                    },
                    children: `${(el.content || 'SHOP NOW').toUpperCase()} →`
                  }
                }
              ]
            }
          });
        } else {
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
                justifyContent: el.align === 'center' ? 'center' : (el.align === 'right' ? 'flex-end' : 'flex-start'),
                color: el.color || '#FFFFFF',
                fontSize: `${el.font_size || 40}px`,
                fontWeight: el.font_weight === 'bold' ? 700 : 500,
                textAlign: el.align || 'left',
                lineHeight: 1.2,
              },
              children: el.content || ''
            }
          });
        }
      } else if (elType === 'badge') {
        const badgeText = (el.badge_text || el.content || '').trim();
        if (badgeText) {
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
                justifyContent: 'center',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      backgroundColor: accentColor,
                      color: textOnDark,
                      padding: '8px 18px',
                      borderRadius: '12px',
                      fontSize: `${Math.max(12, Math.floor(h * 0.3))}px`,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                    },
                    children: badgeText
                  }
                }
              ]
            }
          });
        }
      } else if (elType === 'shape') {
        // Only render shape if it has explicit role or opacity
        children.push({
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              left: `${x}px`,
              top: `${y}px`,
              width: `${w}px`,
              height: `${h}px`,
              backgroundColor: accentColor,
              borderRadius: '16px',
              opacity: el.opacity || 0.85,
            }
          }
        });
      } else if (['photo', 'cat_photo', 'library_image', 'background_asset'].includes(elType) && el.resolved) {
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

    rootElement = {
      type: 'div',
      props: {
        style: {
          width: `${canvasW}px`,
          height: `${canvasH}px`,
          display: 'flex',
          position: 'relative',
          backgroundColor: props.background_color || '#0F172A',
        },
        children: children
      }
    };

  }

  // Generate SVG via Satori
  const svg = await satori(rootElement, {
    width: canvasW,
    height: canvasH,
    fonts: [
      {
        name: 'Roboto',
        data: fontBufferBold,
        weight: 700,
        style: 'normal',
      },
      {
        name: 'Roboto',
        data: fontBufferRegular,
        weight: 400,
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
