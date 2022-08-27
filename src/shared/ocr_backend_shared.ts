export type Bbox = {
    x0: number, x1: number, y0: number, y1: number
};

export type Word = {
    symbols: {
        bbox: Bbox
    }[],
    bbox: Bbox,
    text: string
}

export type RecognizeResult = {
    data: {
        words: Word[]
    }
};

