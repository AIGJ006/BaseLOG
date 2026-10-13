import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import NestScene from '../NestScene';
import { look } from './nestFixtures';

describe('NestScene (021)', () => {
  it('새 크기와 장착한 장식을 그리고 화면 읽기 설명을 단다', () => {
    render(
      <NestScene
        look={look({
          level: 3,
          levelName: '어린 새',
          background: 'bg-sunset',
          decorations: ['deco-egg', 'deco-star'],
        })}
      />,
    );
    expect(screen.getByRole('img')).toHaveAccessibleName(
      '어린 새가 사는 둥지, 배경 노을, 장식 알·별',
    );
    expect(screen.getByTestId('nest-scene')).toHaveAttribute('data-level', '3');
    expect(screen.getByTestId('nest-bird').getAttribute('transform')).toContain('scale(0.8)');
    expect(screen.getByTestId('deco-egg')).toBeInTheDocument();
    expect(screen.getByTestId('deco-star')).toBeInTheDocument();
    expect(screen.queryByTestId('deco-leaf')).toBeNull();
  });

  it('모르는 배경·테두리 코드는 기본으로 그린다', () => {
    render(<NestScene look={look({ background: 'bg-rainbow', border: 'border-x' })} />);
    expect(screen.getByTestId('nest-scene')).toHaveClass('nest-scene--border-none');
    expect(screen.getByRole('img').querySelector('rect')).toHaveAttribute(
      'fill',
      'var(--nest-bg-basic)',
    );
  });

  it('테두리 물건은 틀 모양으로 붙는다', () => {
    render(<NestScene look={look({ border: 'border-gold' })} />);
    expect(screen.getByTestId('nest-scene')).toHaveClass('nest-scene--border-gold');
  });
});
