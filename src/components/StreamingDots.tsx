import styles from './StreamingDots.module.css';

export function StreamingDots() {
  return (
    <span className={styles.root} role="status" aria-label="Agent is responding">
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.dot} aria-hidden="true" />
    </span>
  );
}
