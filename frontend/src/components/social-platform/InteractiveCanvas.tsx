import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Text, Rect, Group, Image as KonvaImage, Transformer } from 'react-konva';
import useImage from 'use-image';
import { 
  Type, 
  Palette, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  Bold, 
  Layers, 
  Sliders, 
  Sparkles,
  Move,
  Trash2
} from 'lucide-react';
import { axiosInstance } from '@/lib/axios';

interface InteractiveCanvasProps {
  trace: any;
  onUpdateElement: (index: number, newProps: any) => void;
  onSelectElement?: (index: number | null) => void;
  selectedElementIndex?: number | null;
}

const ElementImage = ({ element, isSelected, onSelect, onChange }: any) => {
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  
  let imgSrc = '';
  if (element.resolved) {
    if (element.type === 'icon' && !element.resolved.startsWith('http')) {
      const parts = element.resolved.split(':');
      if (parts.length === 2) {
        imgSrc = `https://api.iconify.design/${parts[0]}/${parts[1]}.svg`;
      }
    } else if (['photo', 'cat_photo', 'library_image', 'background_asset'].includes(element.type)) {
      imgSrc = element.resolved;
    }
  }

  const [image] = useImage(imgSrc, 'anonymous');

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  return (
    <React.Fragment>
      <KonvaImage
        onClick={onSelect}
        onTap={onSelect}
        ref={shapeRef}
        image={image}
        x={element.x || 0}
        y={element.y || 0}
        width={element.w || 100}
        height={element.h || 100}
        draggable
        onDragEnd={(e) => {
          onChange({
            ...element,
            x: e.target.x(),
            y: e.target.y(),
          });
        }}
        onTransformEnd={(e) => {
          const node = shapeRef.current;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          onChange({
            ...element,
            x: node.x(),
            y: node.y(),
            w: Math.max(5, node.width() * scaleX),
            h: Math.max(5, node.height() * scaleY),
            rotation: node.rotation(),
          });
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 5 || newBox.height < 5) return oldBox;
            return newBox;
          }}
        />
      )}
    </React.Fragment>
  );
};

const ElementButton = ({ element, isSelected, onSelect, onChange, accentColor }: any) => {
  const groupRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  useEffect(() => {
    if (isSelected && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  const w = element.w || 300;
  const h = element.h || 60;
  const btnColor = element.color && element.color !== '#FFFFFF' ? element.color : (accentColor || '#0D9488');
  const btnText = `${(element.content || 'SHOP NOW').toUpperCase()} →`;

  return (
    <React.Fragment>
      <Group
        ref={groupRef}
        x={element.x || 0}
        y={element.y || 0}
        width={w}
        height={h}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          onChange({
            ...element,
            x: e.target.x(),
            y: e.target.y(),
          });
        }}
      >
        {/* Pill Background */}
        <Rect
          width={w}
          height={h}
          fill={btnColor}
          cornerRadius={h / 2}
          shadowColor="rgba(0,0,0,0.35)"
          shadowBlur={12}
          shadowOffsetY={4}
        />
        {/* Centered Button Text */}
        <Text
          width={w}
          height={h}
          text={btnText}
          fill="#FFFFFF"
          fontFamily={element.font_family || 'sans-serif'}
          fontSize={Math.max(16, element.font_size ? Math.min(element.font_size, 26) : 22)}
          fontStyle="bold"
          align="center"
          verticalAlign="middle"
          letterSpacing={2}
        />
      </Group>
      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 10 || newBox.height < 10) return oldBox;
            return newBox;
          }}
        />
      )}
    </React.Fragment>
  );
};

const ElementBadge = ({ element, isSelected, onSelect, onChange, accentColor }: any) => {
  const groupRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  useEffect(() => {
    if (isSelected && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  const w = element.w || 220;
  const h = element.h || 120;
  const badgeColor = element.color || accentColor || '#4F46E5';
  const badgeText = element.badge_text || element.content || 'FEATURED';

  return (
    <React.Fragment>
      <Group
        ref={groupRef}
        x={element.x || 0}
        y={element.y || 0}
        width={w}
        height={h}
        rotation={element.rotation || -5}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          onChange({
            ...element,
            x: e.target.x(),
            y: e.target.y(),
          });
        }}
      >
        <Rect
          width={w}
          height={h}
          fill={badgeColor}
          cornerRadius={16}
          shadowColor="rgba(0,0,0,0.3)"
          shadowBlur={8}
          shadowOffsetY={3}
        />
        <Text
          width={w}
          height={h}
          text={badgeText.toUpperCase()}
          fill="#FFFFFF"
          fontFamily={element.font_family || 'sans-serif'}
          fontSize={Math.max(14, Math.floor(h * 0.22))}
          fontStyle="bold"
          align="center"
          verticalAlign="middle"
          padding={8}
        />
      </Group>
      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 10 || newBox.height < 10) return oldBox;
            return newBox;
          }}
        />
      )}
    </React.Fragment>
  );
};

const ElementText = ({ element, isSelected, onSelect, onChange }: any) => {
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  return (
    <React.Fragment>
      <Text
        onClick={onSelect}
        onTap={onSelect}
        ref={shapeRef}
        text={element.content}
        x={element.x || 0}
        y={element.y || 0}
        width={element.w || 100}
        height={element.h || 100}
        fill={element.color || '#000000'}
        fontFamily={element.font_family || 'sans-serif'}
        fontSize={element.font_size || 24}
        fontStyle={element.font_weight === 'bold' ? 'bold' : 'normal'}
        align={element.text_align || 'left'}
        lineHeight={1.15}
        draggable
        onDragEnd={(e) => {
          onChange({
            ...element,
            x: e.target.x(),
            y: e.target.y(),
          });
        }}
        onTransformEnd={(e) => {
          const node = shapeRef.current;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          onChange({
            ...element,
            x: node.x(),
            y: node.y(),
            w: Math.max(5, node.width() * scaleX),
            h: Math.max(5, node.height() * scaleY),
            font_size: (element.font_size || 24) * scaleY,
            rotation: node.rotation(),
          });
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 5 || newBox.height < 5) return oldBox;
            return newBox;
          }}
        />
      )}
    </React.Fragment>
  );
};

const ElementShape = ({ element, isSelected, onSelect, onChange, accentColor }: any) => {
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  const fillColor = element.color || accentColor || '#3B82F6';

  return (
    <React.Fragment>
      <Rect
        onClick={onSelect}
        onTap={onSelect}
        ref={shapeRef}
        x={element.x || 0}
        y={element.y || 0}
        width={element.w || 100}
        height={element.h || 100}
        fill={fillColor}
        opacity={element.opacity || 0.9}
        cornerRadius={12}
        draggable
        onDragEnd={(e) => {
          onChange({
            ...element,
            x: e.target.x(),
            y: e.target.y(),
          });
        }}
        onTransformEnd={(e) => {
          const node = shapeRef.current;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          onChange({
            ...element,
            x: node.x(),
            y: node.y(),
            w: Math.max(5, node.width() * scaleX),
            h: Math.max(5, node.height() * scaleY),
            rotation: node.rotation(),
          });
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 5 || newBox.height < 5) return oldBox;
            return newBox;
          }}
        />
      )}
    </React.Fragment>
  );
};

export const InteractiveCanvas = ({ trace, onUpdateElement, onSelectElement, selectedElementIndex }: InteractiveCanvasProps) => {
  const [selectedId, selectShape] = useState<number | null>(null);
  const [installedFonts, setInstalledFonts] = useState<any[]>([]);

  useEffect(() => {
    axiosInstance.get('/api/fonts').then((res) => {
      setInstalledFonts(res.data.installed_fonts || []);
    }).catch(() => null);
  }, []);

  useEffect(() => {
    if (selectedElementIndex !== undefined) {
      selectShape(selectedElementIndex);
    }
  }, [selectedElementIndex]);

  const handleSelect = (index: number | null) => {
    selectShape(index);
    if (onSelectElement) onSelectElement(index);
  };

  const checkDeselect = (e: any) => {
    const clickedOnEmpty = e.target === e.target.getStage();
    if (clickedOnEmpty) {
      handleSelect(null);
    }
  };

  const canvasW = trace.canvas_w || 1080;
  const canvasH = trace.canvas_h || 1080;
  const bgColor = trace.art_director?.background_color || '#ffffff';
  const palette = trace.palette || {};
  const accentColor = palette.accent_color || palette.accent || '#0D9488';

  const elements = [...(trace.resolved_assets || [])].sort((a, b) => (a.z_index || 1) - (b.z_index || 1));
  const scale = 420 / canvasW;

  const activeElement = selectedId !== null && trace.resolved_assets ? trace.resolved_assets[selectedId] : null;

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Canvas Stage Frame */}
      <Stage
        width={canvasW * scale}
        height={canvasH * scale}
        scaleX={scale}
        scaleY={scale}
        onMouseDown={checkDeselect}
        onTouchStart={checkDeselect}
        style={{
          backgroundColor: bgColor,
          borderRadius: '0.75rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
        }}
      >
        <Layer>
          {elements.map((el, i) => {
            const originalIndex = trace.resolved_assets.indexOf(el);
            const isSelected = originalIndex === selectedId;
            const role = (el.role || '').toLowerCase();
            const slot = (el.slot || '').toLowerCase();

            if (el.type === 'photo' || el.type === 'cat_photo' || el.type === 'icon' || el.type === 'emoji') {
              return (
                <ElementImage
                  key={i}
                  element={el}
                  isSelected={isSelected}
                  onSelect={() => handleSelect(originalIndex)}
                  onChange={(newAttrs: any) => onUpdateElement(originalIndex, newAttrs)}
                />
              );
            } else if (el.type === 'badge') {
              return (
                <ElementBadge
                  key={i}
                  element={el}
                  isSelected={isSelected}
                  onSelect={() => handleSelect(originalIndex)}
                  onChange={(newAttrs: any) => onUpdateElement(originalIndex, newAttrs)}
                  accentColor={accentColor}
                />
              );
            } else if (el.type === 'text') {
              if (role === 'cta' || role === 'button' || slot === 'cta_text') {
                return (
                  <ElementButton
                    key={i}
                    element={el}
                    isSelected={isSelected}
                    onSelect={() => handleSelect(originalIndex)}
                    onChange={(newAttrs: any) => onUpdateElement(originalIndex, newAttrs)}
                    accentColor={accentColor}
                  />
                );
              }
              return (
                <ElementText
                  key={i}
                  element={el}
                  isSelected={isSelected}
                  onSelect={() => handleSelect(originalIndex)}
                  onChange={(newAttrs: any) => onUpdateElement(originalIndex, newAttrs)}
                />
              );
            } else if (el.type === 'shape') {
              return (
                <ElementShape
                  key={i}
                  element={el}
                  isSelected={isSelected}
                  onSelect={() => handleSelect(originalIndex)}
                  onChange={(newAttrs: any) => onUpdateElement(originalIndex, newAttrs)}
                  accentColor={accentColor}
                />
              );
            }
            return null;
          })}
        </Layer>
      </Stage>

      {/* Floating Property Inspector for Selected Element */}
      {activeElement && selectedId !== null && (
        <div className="w-full max-w-xl bg-white border border-slate-200 rounded-xl p-3.5 shadow-md animate-in fade-in slide-in-from-bottom-2 duration-150 text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2.5">
            <span className="font-bold text-slate-900 flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-purple-600" />
              Element Inspector: <span className="font-mono text-purple-700">{activeElement.role || activeElement.type}</span>
            </span>
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className="text-[11px] text-slate-400 hover:text-slate-700"
            >
              Deselect
            </button>
          </div>

          <div className="grid gap-3">
            {/* If Text or Button Element: Content & Multi-Font Picker */}
            {(activeElement.type === 'text' || activeElement.type === 'badge') && (
              <div className="grid gap-2 sm:grid-cols-2">
                {/* Content string */}
                <div className="grid gap-1">
                  <span className="text-[10px] font-semibold text-slate-500">Text Content</span>
                  <input
                    type="text"
                    value={activeElement.content || activeElement.badge_text || ''}
                    onChange={(e) => onUpdateElement(selectedId, {
                      ...activeElement,
                      content: e.target.value,
                      badge_text: e.target.value,
                    })}
                    className="h-8 px-2 rounded-md border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:outline-purple-600"
                  />
                </div>

                {/* Per-Element Font Family Selector */}
                <div className="grid gap-1">
                  <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
                    <Type className="size-3 text-purple-600" /> Font Family
                  </span>
                  <select
                    value={activeElement.font_family || ''}
                    onChange={(e) => onUpdateElement(selectedId, {
                      ...activeElement,
                      font_family: e.target.value || undefined,
                    })}
                    className="h-8 px-2 rounded-md border border-slate-200 bg-white text-xs text-slate-900 focus:outline-purple-600"
                  >
                    <option value="">(Theme Default Font)</option>
                    {installedFonts.map((f) => (
                      <option key={f.filename} value={f.family}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Font Size & Color */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1">
                    <span className="text-[10px] font-semibold text-slate-500">Font Size (px)</span>
                    <input
                      type="number"
                      min={10}
                      max={160}
                      value={Math.round(activeElement.font_size || 36)}
                      onChange={(e) => onUpdateElement(selectedId, {
                        ...activeElement,
                        font_size: Number(e.target.value),
                      })}
                      className="h-8 px-2 rounded-md border border-slate-200 bg-slate-50 text-xs"
                    />
                  </div>
                  <div className="grid gap-1">
                    <span className="text-[10px] font-semibold text-slate-500">Color</span>
                    <div className="flex items-center gap-1.5 h-8 px-2 rounded-md border border-slate-200 bg-slate-50">
                      <input
                        type="color"
                        value={activeElement.color || '#FFFFFF'}
                        onChange={(e) => onUpdateElement(selectedId, {
                          ...activeElement,
                          color: e.target.value,
                        })}
                        className="size-5 rounded cursor-pointer border-0 p-0"
                      />
                      <span className="font-mono text-[10px] text-slate-600 uppercase">
                        {activeElement.color || '#FFFFFF'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Weight & Alignment */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onUpdateElement(selectedId, {
                        ...activeElement,
                        font_weight: activeElement.font_weight === 'bold' ? 'regular' : 'bold',
                      })}
                      className={`h-7 px-2.5 rounded text-xs font-bold border ${
                        activeElement.font_weight === 'bold'
                          ? 'bg-purple-100 border-purple-300 text-purple-800'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      Bold
                    </button>
                  </div>

                  <div className="flex items-center gap-1 border border-slate-200 rounded p-0.5 bg-slate-50">
                    <button
                      type="button"
                      onClick={() => onUpdateElement(selectedId, { ...activeElement, text_align: 'left' })}
                      className={`p-1 rounded ${activeElement.text_align === 'left' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-400'}`}
                      title="Align Left"
                    >
                      <AlignLeft className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateElement(selectedId, { ...activeElement, text_align: 'center' })}
                      className={`p-1 rounded ${activeElement.text_align === 'center' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-400'}`}
                      title="Align Center"
                    >
                      <AlignCenter className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateElement(selectedId, { ...activeElement, text_align: 'right' })}
                      className={`p-1 rounded ${activeElement.text_align === 'right' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-400'}`}
                      title="Align Right"
                    >
                      <AlignRight className="size-3" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* If Shape / Image: Opacity and Color */}
            {(activeElement.type === 'shape' || activeElement.type === 'photo') && (
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <span className="text-[10px] font-semibold text-slate-500">Opacity ({Math.round((activeElement.opacity ?? 1) * 100)}%)</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={activeElement.opacity ?? 1}
                    onChange={(e) => onUpdateElement(selectedId, {
                      ...activeElement,
                      opacity: Number(e.target.value),
                    })}
                    className="h-7 accent-purple-600"
                  />
                </div>
                {activeElement.type === 'shape' && (
                  <div className="grid gap-1">
                    <span className="text-[10px] font-semibold text-slate-500">Fill Color</span>
                    <div className="flex items-center gap-1.5 h-7 px-2 rounded border border-slate-200 bg-slate-50">
                      <input
                        type="color"
                        value={activeElement.color || accentColor}
                        onChange={(e) => onUpdateElement(selectedId, {
                          ...activeElement,
                          color: e.target.value,
                        })}
                        className="size-4 rounded cursor-pointer border-0 p-0"
                      />
                      <span className="font-mono text-[10px] text-slate-600 uppercase">
                        {activeElement.color || accentColor}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
