/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { ReactNode } from 'react';

interface CollapsibleProps {
  summary: ReactNode;
  children: ReactNode;
}

const Collapsible: React.FC<CollapsibleProps> = ({ summary, children }) => {
  return (
    <details className="collapsible-details">
      <summary>
        <span className="icon toggle-icon">chevron_right</span>
        {summary}
      </summary>
      <div className="collapsible-content">{children}</div>
    </details>
  );
};

export default Collapsible;
