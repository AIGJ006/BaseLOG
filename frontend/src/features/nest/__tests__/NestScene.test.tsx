import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import NestScene from '../NestScene';
import { look } from './nestFixtures';

describe('NestScene (021)', () => {
  it('새 단계 그림과 장착한 둥지·소품·새 장식을 놓고 화면 읽기 설명을 단다', () => {
    render(
      <NestScene
        look={look({
          level: 3,
          levelName: '어린 새',
          background: 'bg-sunset',
          nestType: 'nest-flower',
          decorations: ['prop-mushroom', 'acc-ribbon'],
        })}
      />,
    );
    expect(screen.getByRole('img')).toHaveAccessibleName(
      '어린 새가 사는 꽃 둥지, 배경 노을, 장식 버섯·나비 리본',
    );
    expect(screen.getByTestId('nest-scene')).toHaveClass('nest-scene--bg-sunset');
    expect(screen.getByTestId('nest-bird')).toHaveAttribute('data-stage', '3');
    expect(screen.getByTestId('nest-type')).toHaveAttribute('data-code', 'nest-flower');
    // 리본은 새 그림 안(머리 위)에, 버섯은 그림 칸에 놓인다
    expect(screen.getByTestId('nest-bird')).toContainElement(screen.getByTestId('acc-ribbon'));
    expect(screen.getByTestId('nest-bird')).not.toContainElement(
      screen.getByTestId('prop-mushroom'),
    );
    expect(screen.queryByTestId('acc-crown')).toBeNull();
  });

  it('처음 모습은 기본 숲·기본 둥지이고, 모르는 코드는 기본으로 그린다', () => {
    render(
      <NestScene
        look={look({ level: 9, background: 'bg-rainbow', nestType: 'nest-x', decorations: ['?'] })}
      />,
    );
    expect(screen.getByTestId('nest-scene')).toHaveClass('nest-scene--bg-basic');
    expect(screen.getByTestId('nest-type')).toHaveAttribute('data-code', 'nest-basic');
    expect(screen.getByTestId('nest-bird')).toHaveAttribute('data-stage', '4');
    expect(screen.getByRole('img')).toHaveAccessibleName(
      '꼬마 새가 사는 기본 둥지, 배경 기본 숲, 장식 ?',
    );
  });
});
