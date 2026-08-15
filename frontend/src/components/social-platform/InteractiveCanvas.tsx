import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Text, Rect, Image as KonvaImage, Transformer } from 'react-konva';
import useImage from 'use-image';

interface InteractiveCanvasProps {
  trace: any;
  onUpdateElement: (index: number, newProps: any) => void;
  onSelectElement?: (index: number | null) => void;
}

const ElementImage = ({ element, isSelected, onSelect, onChange }: any) => {
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  
  // if resolved is a url or iconify string
  let imgSrc = '';
  if (element.resolved) {
    if (element.type === 'icon' && !element.resolved.startsWith('http')) {
      // Convert 'lucide:sparkles' to 'https://api.iconify.design/lucide/sparkles.svg'
      const parts = element.resolved.split(':');
      if (parts.length === 2) {
        imgSrc = `https://api.iconify.design/${parts[0]}/${parts[1]}.svg`;
      }
    } else if (element.type === 'emoji' && !element.resolved.startsWith('http')) {
      // Emojis are hard to render natively on canvas without text nodes, but backend uses Twemoji. 
      // If the backend didn't resolve to a URL, we can attempt a generic twemoji URL or just fallback.
      // For simplicity, if it's just a raw emoji character, we might not render it as image.
      imgSrc = ''; // Needs a proper emoji-to-url mapper if we want images
    } else if (['photo', 'cat_photo', 'library_image', 'background_asset'].includes(element.type)) {
      imgSrc = element.resolved;
    }
  }

  // `useImage` handles loading the image from the URL. CORS must be permitted on the source.
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
            if (newBox.width < 5 || newBox.height < 5) {
              return oldBox;
            }
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
        fontSize={element.font_size || 24}
        fontStyle={element.font_weight === 'bold' ? 'bold' : 'normal'}
        align={element.text_align || 'left'}
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
            font_size: (element.font_size || 24) * scaleY, // Scale font size
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

const ElementShape = ({ element, isSelected, onSelect, onChange }: any) => {
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
      <Rect
        onClick={onSelect}
        onTap={onSelect}
        ref={shapeRef}
        x={element.x || 0}
        y={element.y || 0}
        width={element.w || 100}
        height={element.h || 100}
        fill={element.color || '#000000'}
        opacity={element.opacity || 1}
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


export const InteractiveCanvas = ({ trace, onUpdateElement, onSelectElement }: InteractiveCanvasProps) => {
  const [selectedId, selectShape] = useState<number | null>(null);

  const handleSelect = (index: number | null) => {
    selectShape(index);
    if (onSelectElement) onSelectElement(index);
  }

  const checkDeselect = (e: any) => {
    // deselect when clicked on empty area
    const clickedOnEmpty = e.target === e.target.getStage();
    if (clickedOnEmpty) {
      handleSelect(null);
    }
  };

  const canvasW = trace.canvas_w || 1080;
  const canvasH = trace.canvas_h || 1080;
  const bgColor = trace.art_director?.background_color || '#ffffff';

  // Sort elements by z_index
  const elements = [...(trace.resolved_assets || [])].sort((a, b) => (a.z_index || 1) - (b.z_index || 1));

  // The stage needs to scale down to fit the container. We'll use a fixed internal scale,
  // and CSS will handle making the wrapper responsive if needed.
  // Actually React Konva Stage uses pixel dimensions. We'll scale the stage down.
  const scale = 400 / canvasW; // Fit into a 400px box roughly

  return (
    <Stage
      width={canvasW * scale}
      height={canvasH * scale}
      scaleX={scale}
      scaleY={scale}
      onMouseDown={checkDeselect}
      onTouchStart={checkDeselect}
      style={{ backgroundColor: bgColor, border: '1px solid #e2e8f0', borderRadius: '0.375rem' }}
    >
      <Layer>
        {elements.map((el, i) => {
          // Find original index to pass to onUpdateElement
          const originalIndex = trace.resolved_assets.indexOf(el);
          
          if (el.type === 'photo' || el.type === 'cat_photo' || el.type === 'icon' || el.type === 'emoji') {
            return (
              <ElementImage
                key={i}
                element={el}
                isSelected={originalIndex === selectedId}
                onSelect={() => handleSelect(originalIndex)}
                onChange={(newAttrs: any) => onUpdateElement(originalIndex, newAttrs)}
              />
            );
          } else if (el.type === 'text') {
            return (
              <ElementText
                key={i}
                element={el}
                isSelected={originalIndex === selectedId}
                onSelect={() => handleSelect(originalIndex)}
                onChange={(newAttrs: any) => onUpdateElement(originalIndex, newAttrs)}
              />
            );
          } else if (el.type === 'shape') {
            return (
              <ElementShape
                key={i}
                element={el}
                isSelected={originalIndex === selectedId}
                onSelect={() => handleSelect(originalIndex)}
                onChange={(newAttrs: any) => onUpdateElement(originalIndex, newAttrs)}
              />
            );
          }
          return null;
        })}
      </Layer>
    </Stage>
  );
};
