type ScriptProps = {
    id?: string;
    src?: string;
    onLoad?: () => void;
    onError?: () => void;
};

/** External provider scripts are intentionally disabled in the isolated pilot. */
export default function Script(props: ScriptProps) {
    void props;
    return null;
}
